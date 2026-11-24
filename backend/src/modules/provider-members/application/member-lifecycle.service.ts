import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InternalRole } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import type { ProviderMemberOperationsQueryDto } from '../dto/provider-member-verification.dto';
import { assertMemberVerificationComplete } from '../domain/member-verification.policy';
import { ProviderMemberAccessService } from './provider-member-access.service';
import { providerMemberSelect } from './provider-members.select';
import { loadMemberOfferings } from './verification/member-verification-offerings';
import {
  currentVerification,
  lockVerificationMember,
} from './verification/member-verification.persistence';

export const MEMBER_OPERATIONS_ROLES: InternalRole[] = [
  InternalRole.ADMIN,
  InternalRole.MODERATOR,
  InternalRole.SUPPORT,
];
type LifecycleActor =
  { ownerUserId: string } | { internal: AuthenticatedInternalAccount };

@Injectable()
export class MemberLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async listForOperations(
    query: ProviderMemberOperationsQueryDto,
    actor: AuthenticatedInternalAccount,
  ) {
    if (!actor.roles.some((r) => MEMBER_OPERATIONS_ROLES.includes(r)))
      throw new ForbiddenException('Không có quyền vận hành thành viên.');
    const data = await this.prisma.providerMember.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.providerId ? { providerId: query.providerId } : {}),
        provider: { providerType: 'ORGANIZATION' },
      },
      select: {
        ...providerMemberSelect,
        suspendedAt: true,
        suspensionSource: true,
        suspensionReason: true,
        provider: { select: { displayName: true, status: true } },
      },
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { success: true, data };
  }

  async change(
    memberId: string,
    action: 'suspend' | 'reactivate',
    reason: string,
    actor: LifecycleActor,
    request: RequestMetadata,
  ) {
    if (
      'internal' in actor &&
      !actor.internal.roles.some((r) => MEMBER_OPERATIONS_ROLES.includes(r))
    )
      throw new ForbiddenException('Không có quyền vận hành thành viên.');
    const data = await this.prisma.$transaction(async (tx) => {
      if ('ownerUserId' in actor) {
        const owner = await this.access.requireOrganizationOwner(
          actor.ownerUserId,
          tx,
        );
        const owned = await tx.providerMember.findFirst({
          where: { id: memberId, providerId: owner.providerId },
          select: { id: true },
        });
        if (!owned)
          throw new NotFoundException(
            'Không tìm thấy thành viên trong tổ chức.',
          );
      }
      const member = await lockVerificationMember(tx, memberId);
      if (member.role === 'OWNER')
        throw new ForbiddenException(
          'Không thay đổi owner bằng API vận hành worker.',
        );
      if (action === 'suspend') {
        const escalate =
          member.status === 'SUSPENDED' &&
          'internal' in actor &&
          member.suspensionSource === 'OWNER';
        if (member.status === 'SUSPENDED' && !escalate)
          return this.present(member);
        await tx.providerMember.update({
          where: { id: memberId },
          data: {
            status: 'SUSPENDED',
            suspendedAt: new Date(),
            suspensionReason: reason,
            suspendedFromStatus: escalate
              ? member.suspendedFromStatus
              : member.status,
            suspensionSource: 'ownerUserId' in actor ? 'OWNER' : 'INTERNAL',
          },
        });
      } else {
        if (member.status !== 'SUSPENDED')
          throw new ConflictException('Chỉ khôi phục worker đang đình chỉ.');
        if ('ownerUserId' in actor && member.suspensionSource !== 'OWNER')
          throw new ForbiddenException(
            'Chỉ bộ phận vận hành được gỡ đình chỉ do hệ thống áp dụng.',
          );
        if (
          member.provider.status !== 'ACTIVE' ||
          member.user.status !== 'ACTIVE'
        )
          throw new ConflictException(
            'Tổ chức hoặc tài khoản chưa đủ điều kiện hoạt động.',
          );
        if (
          !member.suspendedFromStatus ||
          !['ACTIVE', 'PENDING_VERIFICATION'].includes(
            member.suspendedFromStatus,
          )
        )
          throw new ConflictException(
            'Thiếu trạng thái trước đình chỉ; cần kiểm tra thủ công.',
          );
        if (member.suspendedFromStatus === 'ACTIVE') {
          const profile = await currentVerification(tx, member);
          if (profile.status !== 'APPROVED')
            throw new ConflictException('Worker chưa có KYC được duyệt.');
          const offerings = await loadMemberOfferings(
            tx,
            member.providerId,
            profile.requestedProviderServiceIds,
          );
          assertMemberVerificationComplete(profile, offerings, true);
        }
        await tx.providerMember.update({
          where: { id: memberId },
          data: {
            status: member.suspendedFromStatus,
            suspendedAt: null,
            suspensionReason: null,
            suspendedFromStatus: null,
            suspensionSource: null,
          },
        });
      }
      await this.audit.record(
        {
          ...('ownerUserId' in actor
            ? { actorUserId: actor.ownerUserId }
            : { actorInternalAccountId: actor.internal.accountId }),
          action:
            action === 'suspend'
              ? 'PROVIDER_MEMBER_SUSPENDED'
              : 'PROVIDER_MEMBER_REACTIVATED',
          resourceType: 'ProviderMember',
          resourceId: memberId,
          result: 'SUCCESS',
          metadata: { providerId: member.providerId, reason },
        },
        request,
        tx,
      );
      return tx.providerMember.findUniqueOrThrow({
        where: { id: memberId },
        select: providerMemberSelect,
      });
    });
    return { success: true, data };
  }

  private present(member: Awaited<ReturnType<typeof lockVerificationMember>>) {
    return {
      id: member.id,
      providerId: member.providerId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      canProvideServices: member.canProvideServices,
      membershipVersion: member.membershipVersion,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
    };
  }
}
