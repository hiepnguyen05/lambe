import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { parseProviderBirthDate } from '../../../../common/validation/provider-birth-date.policy';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { KycCryptoService } from '../../../../infrastructure/kyc/kyc-crypto.service';
import { claimProviderIdentity } from '../../../../infrastructure/kyc/provider-identity-claim';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { SaveProviderMemberVerificationDto } from '../../dto/provider-member-verification.dto';
import {
  MEMBER_IDENTITY_DOCUMENTS,
  assertMemberVerificationComplete,
} from '../../domain/member-verification.policy';
import {
  MEMBER_DOCUMENT_TYPES,
  MEMBER_TERMS_TEXT,
  MEMBER_TERMS_VERSION,
} from '../../domain/member-verification.constants';
import {
  assertMemberCanVerify,
  assertVerificationEditable,
  currentVerification,
  lockVerificationMember,
  memberVerificationInclude,
  presentVerification,
} from './member-verification.persistence';
import { loadMemberOfferings } from './member-verification-offerings';

@Injectable()
export class MemberVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: KycCryptoService,
    private readonly audit: AuditService,
  ) {}

  async findMine(userId: string, memberId: string) {
    const member = await this.ownedMember(userId, memberId);
    const verification =
      await this.prisma.providerMemberVerification.findUnique({
        where: {
          memberId_membershipVersion: {
            memberId,
            membershipVersion: member.membershipVersion,
          },
        },
        include: memberVerificationInclude,
      });
    return {
      success: true,
      data: verification ? presentVerification(verification) : null,
    };
  }

  async options(userId: string, memberId: string) {
    const member = await this.ownedMember(userId, memberId);
    const services = await this.prisma.providerService.findMany({
      where: {
        providerId: member.providerId,
        status: 'ACTIVE',
        service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        service: {
          select: {
            id: true,
            name: true,
            requiresCertificate: true,
            minExperienceYears: true,
            minPortfolioImages: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: 200,
    });
    return {
      success: true,
      data: {
        termsVersion: MEMBER_TERMS_VERSION,
        termsText: MEMBER_TERMS_TEXT,
        documentTypes: MEMBER_DOCUMENT_TYPES,
        maxImageSizeBytes: 5 * 1024 * 1024,
        services,
      },
    };
  }

  async save(
    userId: string,
    memberId: string,
    dto: SaveProviderMemberVerificationDto,
    request: RequestMetadata,
  ) {
    if (!dto.acceptedTerms || dto.termsVersion !== MEMBER_TERMS_VERSION)
      throw new BadRequestException(
        'Cần chấp thuận điều khoản thành viên hiện hành.',
      );
    const birthDate = parseProviderBirthDate(dto.birthDate);
    const protectedId = this.crypto.protectNationalId(dto.nationalIdNumber);
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId, userId);
      assertMemberCanVerify(member);
      const existing = await tx.providerMemberVerification.findUnique({
        where: {
          memberId_membershipVersion: {
            memberId,
            membershipVersion: member.membershipVersion,
          },
        },
      });
      if (existing) assertVerificationEditable(existing);
      const offerings = await loadMemberOfferings(
        tx,
        member.providerId,
        dto.requestedProviderServiceIds,
      );
      if (
        offerings.length !== dto.requestedProviderServiceIds.length ||
        offerings.some(
          (o) =>
            o.status !== 'ACTIVE' ||
            o.service.status !== 'ACTIVE' ||
            o.service.category.status !== 'ACTIVE',
        )
      )
        throw new BadRequestException(
          'Chỉ chọn dịch vụ đang hoạt động của tổ chức.',
        );
      await claimProviderIdentity(tx, protectedId.hash, userId);
      const identityChanged =
        existing &&
        (existing.nationalIdHash !== protectedId.hash ||
          existing.legalFullName !== dto.legalFullName ||
          existing.birthDate?.getTime() !== birthDate.getTime() ||
          existing.gender !== dto.gender);
      const fields = {
        legalFullName: dto.legalFullName,
        birthDate,
        gender: dto.gender,
        experienceYears: dto.experienceYears,
        nationalIdEncrypted: protectedId.encrypted,
        nationalIdHash: protectedId.hash,
        nationalIdLast4: protectedId.last4,
        requestedProviderServiceIds: dto.requestedProviderServiceIds,
        termsVersion: MEMBER_TERMS_VERSION,
        termsAcceptedAt: new Date(),
      };
      const result = await tx.providerMemberVerification.upsert({
        where: {
          memberId_membershipVersion: {
            memberId,
            membershipVersion: member.membershipVersion,
          },
        },
        create: {
          memberId,
          membershipVersion: member.membershipVersion,
          ...fields,
        },
        update: fields,
      });
      if (identityChanged) {
        await tx.providerMemberDocument.updateMany({
          where: {
            verificationId: result.id,
            supersededAt: null,
            type: { in: MEMBER_IDENTITY_DOCUMENTS },
          },
          data: {
            status: 'PENDING',
            reviewNote: null,
            reviewedAt: null,
            reviewedById: null,
          },
        });
      }
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_VERIFICATION_SAVED',
          resourceType: 'ProviderMemberVerification',
          resourceId: result.id,
          result: 'SUCCESS',
          metadata: { memberId, membershipVersion: member.membershipVersion },
        },
        request,
        tx,
      );
      return presentVerification(await currentVerification(tx, member));
    });
    return { success: true, data };
  }

  async submit(userId: string, memberId: string, request: RequestMetadata) {
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId, userId);
      assertMemberCanVerify(member);
      const profile = await currentVerification(tx, member);
      assertVerificationEditable(profile);
      const offerings = await loadMemberOfferings(
        tx,
        member.providerId,
        profile.requestedProviderServiceIds,
      );
      assertMemberVerificationComplete(profile, offerings, false);
      const revisionNumber = profile.revisionNumber + 1;
      const snapshot: Prisma.InputJsonValue = {
        legalFullName: profile.legalFullName,
        birthDate: profile.birthDate!.toISOString(),
        gender: profile.gender,
        experienceYears: profile.experienceYears,
        nationalIdEncrypted: profile.nationalIdEncrypted,
        requestedProviderServiceIds: profile.requestedProviderServiceIds,
        termsVersion: profile.termsVersion,
        termsAcceptedAt: profile.termsAcceptedAt!.toISOString(),
        documents: profile.documents.map((d) => ({
          id: d.id,
          type: d.type,
          providerServiceId: d.providerServiceId,
          expiresAt: d.expiresAt?.toISOString() ?? null,
        })),
      };
      await tx.providerMemberVerificationRevision.create({
        data: { verificationId: profile.id, revisionNumber, snapshot },
      });
      const updated = await tx.providerMemberVerification.update({
        where: { id: profile.id },
        data: {
          status: 'PENDING_REVIEW',
          revisionNumber,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          decisionReason: null,
        },
        include: memberVerificationInclude,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_VERIFICATION_SUBMITTED',
          resourceType: 'ProviderMemberVerification',
          resourceId: profile.id,
          result: 'SUCCESS',
          metadata: { memberId, revisionNumber },
        },
        request,
        tx,
      );
      return presentVerification(updated);
    });
    return { success: true, data };
  }

  private async ownedMember(userId: string, memberId: string) {
    const member = await this.prisma.providerMember.findFirst({
      where: {
        id: memberId,
        userId,
        status: { not: 'LEFT' },
        provider: { providerType: 'ORGANIZATION' },
      },
      select: { id: true, providerId: true, membershipVersion: true },
    });
    if (!member)
      throw new NotFoundException('Không tìm thấy thành viên tổ chức của bạn.');
    return member;
  }
}
