import { canReceiveOrderPush } from './order-notification-recipient.policy';

describe('order push recipient policy', () => {
  const order = {
    customerId: 'customer',
    status: 'PENDING_PROVIDER' as const,
    providerResponseDeadlineAt: new Date(Date.now() + 600000),
    assignedMemberId: 'member',
    assignedMemberUserId: 'worker',
    assignedMemberVersion: 1,
    provider: {
      userId: 'owner',
      status: 'ACTIVE' as const,
      user: { status: 'ACTIVE' as const },
    },
    assignedMember: {
      userId: 'worker',
      membershipVersion: 1,
      status: 'ACTIVE' as const,
      canProvideServices: true,
      user: { status: 'ACTIVE' as const },
    },
  };
  it('sends an assigned order to its worker, not the owner or a colleague', () => {
    expect(canReceiveOrderPush(order, 'worker', 'ORDER_REQUESTED')).toBe(true);
    expect(canReceiveOrderPush(order, 'owner', 'ORDER_REQUESTED')).toBe(false);
    expect(canReceiveOrderPush(order, 'colleague', 'ORDER_REQUESTED')).toBe(
      false,
    );
  });
  it('revokes working pushes on suspension, account restriction and a new membership term', () => {
    expect(
      canReceiveOrderPush(
        {
          ...order,
          assignedMember: { ...order.assignedMember, status: 'SUSPENDED' },
        },
        'worker',
      ),
    ).toBe(false);
    expect(
      canReceiveOrderPush(
        {
          ...order,
          assignedMember: {
            ...order.assignedMember,
            user: { status: 'BLOCKED' },
          },
        },
        'worker',
      ),
    ).toBe(false);
    expect(
      canReceiveOrderPush(
        {
          ...order,
          assignedMember: { ...order.assignedMember, membershipVersion: 2 },
        },
        'worker',
      ),
    ).toBe(false);
  });
  it('drops requests which are no longer actionable and preserves individual recipient routing', () => {
    expect(
      canReceiveOrderPush(
        { ...order, status: 'COMPLETED' },
        'worker',
        'ORDER_REQUESTED',
      ),
    ).toBe(false);
    expect(
      canReceiveOrderPush(
        { ...order, providerResponseDeadlineAt: new Date(0) },
        'worker',
        'ORDER_REQUESTED',
      ),
    ).toBe(false);
    expect(
      canReceiveOrderPush(
        { ...order, assignedMemberId: null },
        'owner',
        'ORDER_REQUESTED',
      ),
    ).toBe(true);
    expect(canReceiveOrderPush(order, 'customer', 'ORDER_ACCEPTED')).toBe(true);
  });
});
