import type { Prisma } from '@prisma/client';

export function orderNotificationScope(
  userId: string,
): Prisma.OrderNotificationWhereInput {
  return {
    userId,
    order: {
      OR: [
        { customerId: userId },
        { assignedMemberId: null, provider: { userId } },
        { assignedMemberUserId: userId },
      ],
    },
  };
}

export const orderPushAudienceSelect = {
  customerId: true,
  status: true,
  providerResponseDeadlineAt: true,
  assignedMemberId: true,
  assignedMemberUserId: true,
  assignedMemberVersion: true,
  provider: {
    select: { userId: true, status: true, user: { select: { status: true } } },
  },
  assignedMember: {
    select: {
      userId: true,
      status: true,
      membershipVersion: true,
      canProvideServices: true,
      user: { select: { status: true } },
    },
  },
} satisfies Prisma.ServiceOrderSelect;

type Audience = Prisma.ServiceOrderGetPayload<{
  select: typeof orderPushAudienceSelect;
}>;

export function canReceiveOrderPush(
  order: Audience | null,
  userId: string,
  event?: string,
): boolean {
  if (!order) return false;
  if (
    event === 'ORDER_REQUESTED' &&
    (order.status !== 'PENDING_PROVIDER' ||
      order.providerResponseDeadlineAt <= new Date())
  )
    return false;
  if (order.customerId === userId) return true;
  if (
    order.provider.status !== 'ACTIVE' ||
    order.provider.user.status !== 'ACTIVE'
  )
    return false;
  if (!order.assignedMemberId) return order.provider.userId === userId;
  const member = order.assignedMember;
  return (
    order.assignedMemberUserId === userId &&
    !!member &&
    member.userId === userId &&
    member.membershipVersion === order.assignedMemberVersion &&
    member.status === 'ACTIVE' &&
    member.canProvideServices &&
    member.user.status === 'ACTIVE'
  );
}
