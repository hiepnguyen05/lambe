import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { AssignMemberServicesDto } from '../../dto/member-capabilities.dto';
import { ProviderMemberAccessService } from '../provider-member-access.service';
import { assertNoMemberExitObligations } from '../member-exit-obligations';
import {
  capabilityMember,
  closeMemberAvailability,
} from './member-capability-access';
import { loadMemberOfferings } from '../verification/member-verification-offerings';
import {
  memberOfferingInclude,
  memberServiceBlocker,
  memberVerificationForServing,
  presentMemberOffering,
} from './member-service-eligibility';

@Injectable()
export class MemberServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async options(userId: string, memberId: string) {
    const member = await capabilityMember(
      this.prisma,
      userId,
      memberId,
      this.access,
      false,
      true,
    );
    const profile = await memberVerificationForServing(this.prisma, member);
    const offerings = await this.prisma.providerService.findMany({
      where: {
        providerId: member.providerId,
        id: { in: profile?.requestedProviderServiceIds ?? [] },
      },
      include: memberOfferingInclude,
      orderBy: { id: 'asc' },
      take: 50,
    });
    return {
      success: true,
      data: offerings.map((o) => ({
        ...presentMemberOffering(o),
        eligible:
          member.status === 'ACTIVE' &&
          member.canProvideServices &&
          !memberServiceBlocker(profile, o),
        blockerCode:
          member.status !== 'ACTIVE' || !member.canProvideServices
            ? 'MEMBER_INACTIVE'
            : memberServiceBlocker(profile, o),
      })),
    };
  }

  async list(userId: string, memberId: string) {
    const member = await capabilityMember(
      this.prisma,
      userId,
      memberId,
      this.access,
    );
    const profile = await memberVerificationForServing(this.prisma, member);
    const assignments = await this.prisma.providerMemberService.findMany({
      where: { memberId, membershipVersion: member.membershipVersion },
      include: { providerService: { include: memberOfferingInclude } },
      orderBy: [{ enabled: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return {
      success: true,
      data: assignments.map((a) => ({
        ...presentMemberOffering(a.providerService),
        enabled: a.enabled,
        eligible:
          a.enabled &&
          member.status === 'ACTIVE' &&
          member.canProvideServices &&
          !memberServiceBlocker(profile, a.providerService),
        blockerCode: !a.enabled
          ? 'NOT_ASSIGNED'
          : member.status !== 'ACTIVE' || !member.canProvideServices
            ? 'MEMBER_INACTIVE'
            : memberServiceBlocker(profile, a.providerService),
      })),
    };
  }

  async assign(
    userId: string,
    memberId: string,
    dto: AssignMemberServicesDto,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const member = await capabilityMember(
        tx,
        userId,
        memberId,
        this.access,
        true,
        true,
      );
      if (
        dto.providerServiceIds.length &&
        (member.status !== 'ACTIVE' || !member.canProvideServices)
      )
        throw new ConflictException(
          'Thành viên chưa đủ điều kiện cung cấp dịch vụ.',
        );
      await loadMemberOfferings(tx, member.providerId, dto.providerServiceIds);
      const offerings = await tx.providerService.findMany({
        where: {
          providerId: member.providerId,
          id: { in: dto.providerServiceIds },
        },
        include: memberOfferingInclude,
      });
      if (offerings.length !== dto.providerServiceIds.length)
        throw new BadRequestException('Dịch vụ không thuộc tổ chức.');
      const profile = await memberVerificationForServing(tx, member);
      for (const offering of offerings) {
        const code = memberServiceBlocker(profile, offering);
        if (code)
          throw new ConflictException({
            code,
            message:
              'Dịch vụ hoặc KYC/chứng chỉ chưa đủ điều kiện cấp cho thành viên.',
          });
      }
      // Keep outstanding commitments; legacy orders remain organization-wide blockers.
      await assertNoMemberExitObligations(tx, member.providerId, member.id);
      await tx.providerMemberService.updateMany({
        where: { memberId, membershipVersion: member.membershipVersion },
        data: { enabled: false },
      });
      for (const providerServiceId of dto.providerServiceIds)
        await tx.providerMemberService.upsert({
          where: {
            memberId_membershipVersion_providerServiceId: {
              memberId,
              membershipVersion: member.membershipVersion,
              providerServiceId,
            },
          },
          create: {
            memberId,
            membershipVersion: member.membershipVersion,
            providerServiceId,
          },
          update: { enabled: true },
        });
      await closeMemberAvailability(tx, memberId, 'SERVICES_CHANGED');
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_SERVICES_ASSIGNED',
          resourceType: 'ProviderMember',
          resourceId: memberId,
          result: 'SUCCESS',
          metadata: {
            providerServiceIds: dto.providerServiceIds,
            reason: dto.reason ?? null,
          },
        },
        request,
        tx,
      );
    });
    return this.list(userId, memberId);
  }
}
