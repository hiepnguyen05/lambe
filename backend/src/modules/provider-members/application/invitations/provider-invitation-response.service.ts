import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { normalizeVietnamesePhone } from '../../../../common/utils/phone.util';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderMembersQueryDto } from '../../dto/provider-members.dto';
import {
  assertInvitationPending,
  effectiveInvitationStatus,
  matchesInvitationToken,
} from '../../domain/provider-member-invitation.policy';
import { ProviderMemberAccessService } from '../provider-member-access.service';
import { providerMemberSelect } from '../provider-members.select';

@Injectable()
export class ProviderInvitationResponseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async inbox(userId: string, query: ProviderMembersQueryDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true },
    });
    const invitations = await this.prisma.providerMemberInvitation.findMany({
      where: { phone: normalizeVietnamesePhone(user.phone) },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        provider: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      success: true,
      data: invitations.map((item) => ({
        ...item,
        status: effectiveInvitationStatus(item),
      })),
    };
  }

  async respond(
    userId: string,
    id: string,
    token: string,
    accept: boolean,
    request: RequestMetadata,
  ) {
    try {
      const data = await this.prisma.$transaction(async (tx) => {
        const candidate = await tx.providerMemberInvitation.findUnique({
          where: { id },
          select: { providerId: true },
        });
        if (!candidate) throw new NotFoundException('Không tìm thấy lời mời.');
        // All invitation writers serialize on the organization before user/invitation.
        await this.access.lockProvider(tx, candidate.providerId);
        await this.access.lockUser(tx, userId);
        const user = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            phone: true,
            phoneVerifiedAt: true,
            status: true,
            fullName: true,
            avatarUrl: true,
          },
        });
        const invitation = await tx.providerMemberInvitation.findUniqueOrThrow({
          where: { id },
          include: {
            provider: {
              select: {
                providerType: true,
                status: true,
                user: { select: { status: true } },
              },
            },
          },
        });
        if (
          invitation.phone !== normalizeVietnamesePhone(user.phone) ||
          !matchesInvitationToken(token, invitation.tokenHash)
        )
          throw new NotFoundException('Không tìm thấy lời mời.');
        if (user.status !== 'ACTIVE' || !user.phoneVerifiedAt) {
          throw new ForbiddenException(
            'Cần tài khoản hoạt động và số điện thoại đã xác minh.',
          );
        }
        assertInvitationPending(invitation);
        let member: Prisma.ProviderMemberGetPayload<{
          select: typeof providerMemberSelect;
        }> | null = null;
        if (accept) {
          if (
            invitation.provider.providerType !== 'ORGANIZATION' ||
            invitation.provider.status === 'SUSPENDED' ||
            invitation.provider.user.status !== 'ACTIVE'
          )
            throw new ConflictException(
              'Tổ chức hiện không thể nhận thành viên.',
            );
          await this.assertCanJoin(tx, userId, invitation.providerId);
          member = await tx.providerMember.upsert({
            where: {
              providerId_userId: { providerId: invitation.providerId, userId },
            },
            create: {
              providerId: invitation.providerId,
              userId,
              role: 'WORKER',
              status: 'PENDING_VERIFICATION',
              canProvideServices: true,
              displayName: user.fullName,
              avatarUrl: user.avatarUrl,
            },
            update: {
              role: 'WORKER',
              status: 'PENDING_VERIFICATION',
              canProvideServices: true,
              displayName: user.fullName,
              avatarUrl: user.avatarUrl,
              joinedAt: new Date(),
              leftAt: null,
              membershipVersion: { increment: 1 },
              suspendedAt: null,
              suspensionReason: null,
              suspendedFromStatus: null,
              suspensionSource: null,
            },
            select: providerMemberSelect,
          });
          await tx.userRoleAssignment.upsert({
            where: { userId_role: { userId, role: UserRole.PROVIDER } },
            create: { userId, role: UserRole.PROVIDER },
            update: {},
          });
        }
        await tx.providerMemberInvitation.update({
          where: { id },
          data: {
            status: accept ? 'ACCEPTED' : 'DECLINED',
            respondedByUserId: userId,
            respondedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: accept
              ? 'PROVIDER_MEMBER_INVITATION_ACCEPTED'
              : 'PROVIDER_MEMBER_INVITATION_DECLINED',
            resourceType: 'ProviderMemberInvitation',
            resourceId: id,
            result: 'SUCCESS',
            metadata: {
              providerId: invitation.providerId,
              ...(member ? { memberId: member.id } : {}),
            },
          },
          request,
          tx,
        );
        return {
          invitationId: id,
          status: accept ? 'ACCEPTED' : 'DECLINED',
          member,
        };
      });
      return { success: true, data };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Tài khoản đã có membership cung cấp dịch vụ khác.',
        );
      }
      throw error;
    }
  }

  private async assertCanJoin(
    tx: Prisma.TransactionClient,
    userId: string,
    providerId: string,
  ) {
    const [membership, profile, application] = await Promise.all([
      tx.providerMember.findFirst({
        where: {
          userId,
          status: { not: 'LEFT' },
          OR: [{ canProvideServices: true }, { providerId }],
        },
        select: { id: true },
      }),
      tx.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
      tx.providerApplication.findFirst({
        where: {
          userId,
          status: { in: ['DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES'] },
        },
        select: { id: true },
      }),
    ]);
    if (membership || profile || application) {
      throw new ConflictException(
        'Tài khoản đã là đối tác, đang có membership hoặc hồ sơ đăng ký chưa kết thúc.',
      );
    }
  }
}
