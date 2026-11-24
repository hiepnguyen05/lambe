import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Immutable user snapshot allows history access after departure without permitting another membership to execute it.
export function servingOrderWhere(
  userId: string,
): Prisma.ServiceOrderWhereInput {
  return {
    OR: [
      { assignedMemberId: null, provider: { userId } },
      { assignedMemberUserId: userId },
    ],
  };
}

export function providerOrderReadWhere(
  userId: string,
): Prisma.ServiceOrderWhereInput {
  return { OR: [{ provider: { userId } }, { assignedMemberUserId: userId }] };
}

export function orderServingUserId(order: {
  assignedMemberUserId?: string | null;
  provider: { userId: string };
}) {
  return order.assignedMemberUserId ?? order.provider.userId;
}

export async function assertAssignedMemberActive(
  tx: Prisma.TransactionClient,
  order: {
    assignedMemberId?: string | null;
    assignedMemberVersion?: number | null;
    assignedMemberUserId?: string | null;
  },
  userId: string,
) {
  if (!order.assignedMemberId) return;
  const member = await tx.providerMember.findFirst({
    where: {
      id: order.assignedMemberId,
      userId,
      membershipVersion: order.assignedMemberVersion ?? -1,
      status: 'ACTIVE',
      canProvideServices: true,
      user: { status: 'ACTIVE' },
      provider: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
    },
    select: { id: true },
  });
  if (!member || order.assignedMemberUserId !== userId)
    throw new ForbiddenException(
      'Thành viên không còn quyền thực hiện đơn này. Liên hệ hỗ trợ.',
    );
}
