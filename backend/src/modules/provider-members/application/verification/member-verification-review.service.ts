import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { KycCryptoService } from '../../../../infrastructure/kyc/kyc-crypto.service';
import { claimProviderIdentity } from '../../../../infrastructure/kyc/provider-identity-claim';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { AuthenticatedInternalAccount } from '../../../internal-auth/types/authenticated-internal-account.type';
import type {
  DecideProviderMemberVerificationDto,
  ReviewProviderMemberDocumentDto,
} from '../../dto/provider-member-verification.dto';
import { assertMemberKycReviewer } from '../../domain/member-review-access.policy';
import { assertMemberVerificationComplete } from '../../domain/member-verification.policy';
import { providerMemberSelect } from '../provider-members.select';
import { loadMemberOfferings } from './member-verification-offerings';
import {
  assertMemberCanVerify,
  assertReviewRevision,
  currentVerification,
  lockVerificationMember,
  memberVerificationInclude,
  presentVerification,
  safeMemberDocumentSelect,
} from './member-verification.persistence';

@Injectable()
export class MemberVerificationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: KycCryptoService,
    private readonly audit: AuditService,
  ) {}

  async reviewDocument(
    memberId: string,
    documentId: string,
    dto: ReviewProviderMemberDocumentDto,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    assertMemberKycReviewer(actor.roles);
    this.requireReason(dto.status !== 'VERIFIED', dto.reviewNote);
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId);
      const profile = await currentVerification(tx, member);
      assertReviewRevision(profile, dto.revisionNumber, dto.verificationId);
      const document = profile.documents.find((d) => d.id === documentId);
      if (!document)
        throw new BadRequestException(
          'Tài liệu không thuộc phiên bản hiện hành.',
        );
      if (
        dto.status === 'VERIFIED' &&
        document.expiresAt &&
        document.expiresAt <= new Date()
      )
        throw new BadRequestException(
          'Không thể xác minh chứng chỉ đã hết hạn.',
        );
      const updated = await tx.providerMemberDocument.update({
        where: { id: documentId },
        data: {
          status: dto.status,
          reviewNote: dto.reviewNote ?? null,
          reviewedById: actor.accountId,
          reviewedAt: new Date(),
        },
        select: safeMemberDocumentSelect,
      });
      await this.record(
        tx,
        actor.accountId,
        memberId,
        profile.id,
        dto.revisionNumber,
        'DOCUMENT_REVIEWED',
        request,
        { documentId, status: dto.status },
      );
      return updated;
    });
    return { success: true, data };
  }

  async decide(
    memberId: string,
    action: 'approve' | 'request-changes' | 'reject',
    dto: DecideProviderMemberVerificationDto,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    assertMemberKycReviewer(actor.roles);
    this.requireReason(action !== 'approve', dto.reason);
    try {
      const data = await this.prisma.$transaction(async (tx) => {
        const member = await lockVerificationMember(tx, memberId);
        const profile = await currentVerification(tx, member);
        assertReviewRevision(profile, dto.revisionNumber, dto.verificationId);
        if (action === 'approve') {
          assertMemberCanVerify(member);
          if (profile.documents.some((d) => d.status !== 'VERIFIED'))
            throw new BadRequestException(
              'Tất cả tài liệu hiện hành phải được xác minh trước khi duyệt.',
            );
          const offerings = await loadMemberOfferings(
            tx,
            member.providerId,
            profile.requestedProviderServiceIds,
          );
          assertMemberVerificationComplete(profile, offerings, true);
          await claimProviderIdentity(
            tx,
            profile.nationalIdHash!,
            member.userId,
          );
          await tx.providerMember.update({
            where: { id: memberId },
            data: {
              status: 'ACTIVE',
              canProvideServices: true,
              displayName: profile.legalFullName,
            },
          });
        }
        const status =
          action === 'approve'
            ? 'APPROVED'
            : action === 'request-changes'
              ? 'NEEDS_CHANGES'
              : 'REJECTED';
        const updated = await tx.providerMemberVerification.update({
          where: { id: profile.id },
          data: {
            status,
            decisionReason: dto.reason ?? null,
            reviewedAt: new Date(),
            reviewedById: actor.accountId,
          },
          include: memberVerificationInclude,
        });
        await this.record(
          tx,
          actor.accountId,
          memberId,
          profile.id,
          dto.revisionNumber,
          status,
          request,
        );
        return {
          verification: presentVerification(updated),
          member: await tx.providerMember.findUniqueOrThrow({
            where: { id: memberId },
            select: providerMemberSelect,
          }),
        };
      });
      return { success: true, data };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Tài khoản đã có membership cung cấp dịch vụ khác.',
        );
      throw error;
    }
  }

  async accessIdentity(
    memberId: string,
    verificationId: string,
    reason: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    assertMemberKycReviewer(actor.roles);
    this.requireReason(true, reason);
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await lockVerificationMember(tx, memberId);
      const profile = await currentVerification(tx, member);
      if (profile.id !== verificationId)
        throw new ConflictException('Lần xác minh thành viên đã thay đổi.');
      if (!profile.nationalIdEncrypted)
        throw new BadRequestException('Hồ sơ chưa có CCCD.');
      const nationalIdNumber = this.crypto.revealNationalId(
        profile.nationalIdEncrypted,
      );
      await this.audit.record(
        {
          actorInternalAccountId: actor.accountId,
          action: 'PROVIDER_MEMBER_IDENTITY_ACCESSED',
          resourceType: 'ProviderMemberVerification',
          resourceId: profile.id,
          result: 'SUCCESS',
          metadata: { memberId, reason },
        },
        request,
        tx,
      );
      return { nationalIdNumber };
    });
    return { success: true, data };
  }

  private requireReason(required: boolean, value?: string) {
    if (required && (!value || value.trim().length < 5))
      throw new BadRequestException('Cần lý do ít nhất 5 ký tự.');
  }

  private record(
    tx: Prisma.TransactionClient,
    actorId: string,
    memberId: string,
    verificationId: string,
    revisionNumber: number,
    action: string,
    request: RequestMetadata,
    extra: Prisma.InputJsonObject = {},
  ) {
    return this.audit.record(
      {
        actorInternalAccountId: actorId,
        action: `PROVIDER_MEMBER_VERIFICATION_${action}`,
        resourceType: 'ProviderMemberVerification',
        resourceId: verificationId,
        result: 'SUCCESS',
        metadata: { memberId, revisionNumber, ...extra },
      },
      request,
      tx,
    );
  }
}
