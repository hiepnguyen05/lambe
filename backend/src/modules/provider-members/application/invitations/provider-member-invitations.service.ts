import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { normalizeVietnamesePhone } from '../../../../common/utils/phone.util';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderMembersQueryDto } from '../../dto/provider-members.dto';
import {
  createInvitationSecret,
  effectiveInvitationStatus,
  INVITATION_LIFETIME_MS,
  INVITATION_RESEND_COOLDOWN_MS,
  MAX_PENDING_INVITATIONS,
} from '../../domain/provider-member-invitation.policy';
import { ProviderMemberAccessService } from '../provider-member-access.service';
import { invitationSelect } from '../provider-members.select';

@Injectable()
export class ProviderMemberInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, query: ProviderMembersQueryDto) {
    const owner = await this.access.requireOrganizationOwner(userId);
    const invitations = await this.prisma.providerMemberInvitation.findMany({
      where: { providerId: owner.providerId },
      select: invitationSelect,
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

  async create(userId: string, phone: string, request: RequestMetadata) {
    const secret = createInvitationSecret();
    const data = await this.prisma.$transaction(async (tx) => {
      const owner = await this.access.requireOrganizationOwner(userId, tx);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { phone: true },
      });
      if (normalizeVietnamesePhone(user.phone) === phone) {
        throw new BadRequestException('Không thể tự mời chính mình.');
      }
      await this.expirePending(tx, owner.providerId);
      const duplicate = await tx.providerMemberInvitation.findFirst({
        where: { providerId: owner.providerId, phone, status: 'PENDING' },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          'Số điện thoại này đã có lời mời đang chờ.',
        );
      }
      await this.assertCapacity(tx, owner.providerId);
      const invitation = await tx.providerMemberInvitation.create({
        data: {
          providerId: owner.providerId,
          invitedByUserId: userId,
          phone,
          tokenHash: secret.tokenHash,
          expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
        },
        select: invitationSelect,
      });
      await this.record(
        tx,
        userId,
        invitation.id,
        owner.providerId,
        'CREATED',
        request,
      );
      return invitation;
    });
    // Only the creator receives the plaintext secret, once; never include it in audit.
    return { success: true, data: { ...data, token: secret.token } };
  }

  async resend(userId: string, id: string, request: RequestMetadata) {
    const secret = createInvitationSecret();
    const data = await this.prisma.$transaction(async (tx) => {
      const owner = await this.access.requireOrganizationOwner(userId, tx);
      const invitation = await this.findOwned(tx, id, owner.providerId);
      if (!['PENDING', 'EXPIRED'].includes(invitation.status)) {
        throw new ConflictException(
          'Lời mời đã được xử lý, không thể gửi lại.',
        );
      }
      const now = new Date();
      if (
        now.getTime() - invitation.lastSentAt.getTime() <
        INVITATION_RESEND_COOLDOWN_MS
      ) {
        throw new ConflictException('Vui lòng chờ 60 giây trước khi gửi lại.');
      }
      await this.expirePending(tx, owner.providerId);
      const another = await tx.providerMemberInvitation.findFirst({
        where: {
          providerId: owner.providerId,
          phone: invitation.phone,
          status: 'PENDING',
          id: { not: id },
        },
        select: { id: true },
      });
      if (another) throw new ConflictException('Đã có lời mời mới đang chờ.');
      await this.assertCapacity(tx, owner.providerId, id);
      const result = await tx.providerMemberInvitation.update({
        where: { id },
        data: {
          tokenHash: secret.tokenHash,
          status: 'PENDING',
          lastSentAt: now,
          expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        },
        select: invitationSelect,
      });
      await this.record(tx, userId, id, owner.providerId, 'RESENT', request);
      return result;
    });
    return { success: true, data: { ...data, token: secret.token } };
  }

  async revoke(userId: string, id: string, request: RequestMetadata) {
    const data = await this.prisma.$transaction(async (tx) => {
      const owner = await this.access.requireOrganizationOwner(userId, tx);
      const invitation = await this.findOwned(tx, id, owner.providerId);
      if (invitation.status === 'REVOKED') return invitation;
      if (invitation.status !== 'PENDING') {
        throw new ConflictException('Lời mời đã được xử lý.');
      }
      const result = await tx.providerMemberInvitation.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: new Date() },
        select: invitationSelect,
      });
      await this.record(tx, userId, id, owner.providerId, 'REVOKED', request);
      return result;
    });
    return { success: true, data };
  }

  private async findOwned(
    tx: Prisma.TransactionClient,
    id: string,
    providerId: string,
  ) {
    const invitation = await tx.providerMemberInvitation.findFirst({
      where: { id, providerId },
      select: invitationSelect,
    });
    if (!invitation) throw new NotFoundException('Không tìm thấy lời mời.');
    return invitation;
  }

  private async expirePending(
    tx: Prisma.TransactionClient,
    providerId: string,
  ) {
    await tx.providerMemberInvitation.updateMany({
      where: { providerId, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private async assertCapacity(
    tx: Prisma.TransactionClient,
    providerId: string,
    exceptId?: string,
  ) {
    const count = await tx.providerMemberInvitation.count({
      where: {
        providerId,
        status: 'PENDING',
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (count >= MAX_PENDING_INVITATIONS) {
      throw new ConflictException('Tổ chức đã có tối đa 50 lời mời đang chờ.');
    }
  }

  private record(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    providerId: string,
    action: string,
    request: RequestMetadata,
  ) {
    return this.audit.record(
      {
        actorUserId: userId,
        action: `PROVIDER_MEMBER_INVITATION_${action}`,
        resourceType: 'ProviderMemberInvitation',
        resourceId: id,
        result: 'SUCCESS',
        metadata: { providerId },
      },
      request,
      tx,
    );
  }
}
