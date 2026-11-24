import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProviderMemberAccessService } from '../provider-member-access.service';

export const capabilityMemberInclude = {
  provider: { include: { wallet: true, user: { select: { status: true } } } },
  user: { select: { status: true, phoneVerifiedAt: true } },
} satisfies Prisma.ProviderMemberInclude;
export type CapabilityMember = Prisma.ProviderMemberGetPayload<{
  include: typeof capabilityMemberInclude;
}>;

export async function capabilityMember(
  tx: Prisma.TransactionClient,
  userId: string,
  memberId: string,
  access: ProviderMemberAccessService,
  lock = false,
  ownerOnly = false,
) {
  const owner = ownerOnly
    ? await access.requireOrganizationOwner(userId, lock ? tx : undefined)
    : null;
  const candidate = await tx.providerMember.findUnique({
    where: { id: memberId },
    select: { providerId: true, userId: true },
  });
  if (!candidate || (owner && owner.providerId !== candidate.providerId))
    throw new NotFoundException('Không tìm thấy thành viên.');
  if (!owner && candidate.userId !== userId) {
    const manager = await access.requireOrganizationOwner(
      userId,
      lock ? tx : undefined,
    );
    if (manager.providerId !== candidate.providerId)
      throw new NotFoundException('Không tìm thấy thành viên.');
  }
  if (lock) {
    // Shared organization/user locks let independent workers heartbeat concurrently.
    // Membership/KYC/admin writers take exclusive locks in the same provider -> user -> member order.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${candidate.providerId} FOR SHARE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${candidate.userId} FOR SHARE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_members" WHERE "id" = ${memberId} FOR UPDATE`,
    );
  }
  const member = await tx.providerMember.findUniqueOrThrow({
    where: { id: memberId },
    include: capabilityMemberInclude,
  });
  if (member.status === 'LEFT')
    throw new NotFoundException('Thành viên đã rời tổ chức.');
  if (member.provider.providerType !== 'ORGANIZATION')
    throw new ForbiddenException(
      'Đối tác cá nhân sử dụng API thiết lập hiện có.',
    );
  return member;
}

export function assertCapabilityEditable(
  member: CapabilityMember,
  actorUserId: string,
  reason?: string,
) {
  if (
    member.status === 'SUSPENDED' ||
    member.user.status !== 'ACTIVE' ||
    member.provider.status === 'SUSPENDED' ||
    member.provider.user.status !== 'ACTIVE'
  )
    throw new ForbiddenException('Thành viên hoặc tổ chức đang bị hạn chế.');
  if (actorUserId !== member.userId && (!reason || reason.trim().length < 5))
    throw new ConflictException(
      'Owner phải cung cấp lý do khi sửa lịch/nghỉ phép của thành viên khác.',
    );
}

export async function closeMemberAvailability(
  tx: Prisma.TransactionClient,
  memberId: string,
  reason: string,
) {
  await tx.providerMemberAvailabilitySession.updateMany({
    where: { memberId, endedAt: null },
    data: { endedAt: new Date(), endReason: reason },
  });
  return tx.providerMember.update({
    where: { id: memberId },
    data: { availabilityVersion: { increment: 1 } },
  });
}
