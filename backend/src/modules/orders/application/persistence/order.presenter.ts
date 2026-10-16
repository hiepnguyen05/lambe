import { Prisma, ServiceOrderStatus } from '@prisma/client';
const ADDRESS_VISIBLE_STATUSES = new Set<ServiceOrderStatus>([
  ServiceOrderStatus.ACCEPTED,
  ServiceOrderStatus.EN_ROUTE,
  ServiceOrderStatus.ARRIVED,
  ServiceOrderStatus.IN_PROGRESS,
  ServiceOrderStatus.COMPLETED,
  ServiceOrderStatus.PAYMENT_DISPUTE,
  ServiceOrderStatus.DISPUTED,
]);

export const orderInclude = {
  provider: {
    select: {
      id: true,
      userId: true,
      displayName: true,
      avatarUrl: true,
      serviceRadiusKm: true,
      wallet: true,
    },
  },
  customer: { select: { id: true, fullName: true, phone: true } },
  providerService: {
    select: { id: true, serviceId: true },
  },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  walletHold: true,
  evidence: {
    select: { id: true, type: true, capturedAt: true },
    orderBy: { capturedAt: 'asc' as const },
  },
  cancellationRequest: {
    select: {
      id: true,
      reason: true,
      detail: true,
      status: true,
      requestedAt: true,
      decidedAt: true,
      decisionNote: true,
    },
  },
  review: {
    select: { id: true, rating: true, comment: true, createdAt: true },
  },
  contactAttempts: {
    select: { attemptedAt: true },
    orderBy: { attemptedAt: 'asc' as const },
  },
} satisfies Prisma.ServiceOrderInclude;

export type OrderRecord = Prisma.ServiceOrderGetPayload<{
  include: typeof orderInclude;
}>;

export function presentForCustomer(order: OrderRecord) {
  const safeOrder: Partial<OrderRecord> = { ...order };
  delete safeOrder.requestHash;
  delete safeOrder.clientRequestId;
  delete safeOrder.commissionAmount;
  delete safeOrder.commissionRateBps;
  delete safeOrder.walletHold;
  delete safeOrder.provider;
  delete safeOrder.statusHistory;
  const safeProvider: Partial<OrderRecord['provider']> = {
    ...order.provider,
  };
  delete safeProvider.wallet;
  delete safeProvider.userId;
  return {
    ...safeOrder,
    provider: safeProvider,
    statusHistory: presentHistory(order),
  };
}

export function presentForProvider(order: OrderRecord) {
  const safeOrder: Partial<OrderRecord> = { ...order };
  delete safeOrder.requestHash;
  delete safeOrder.clientRequestId;
  delete safeOrder.walletHold;
  delete safeOrder.provider;
  delete safeOrder.customer;
  delete safeOrder.customerAddressId;
  delete safeOrder.statusHistory;
  const safeProvider: Partial<OrderRecord['provider']> = {
    ...order.provider,
  };
  delete safeProvider.wallet;
  delete safeProvider.userId;
  const canSeeAddress = ADDRESS_VISIBLE_STATUSES.has(order.status);
  return {
    ...safeOrder,
    addressLabel: canSeeAddress ? order.addressLabel : null,
    addressLine: canSeeAddress ? order.addressLine : null,
    addressStreetLine: canSeeAddress ? order.addressStreetLine : null,
    addressLatitude: canSeeAddress ? order.addressLatitude : null,
    addressLongitude: canSeeAddress ? order.addressLongitude : null,
    contactName: canSeeAddress ? order.contactName : null,
    contactPhone: canSeeAddress ? order.contactPhone : null,
    addressNote: canSeeAddress ? order.addressNote : null,
    customerNote: canSeeAddress ? order.customerNote : null,
    provider: safeProvider,
    customer: {
      id: order.customer.id,
      fullName: order.customer.fullName,
      phone: canSeeAddress ? order.customer.phone : null,
    },
    statusHistory: presentHistory(order),
  };
}

function presentHistory(order: OrderRecord) {
  return order.statusHistory.map((history) => ({
    id: history.id,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    reason: history.reason,
    createdAt: history.createdAt,
  }));
}
