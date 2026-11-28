import { Prisma, ServiceOrderStatus, WalletHoldStatus } from '@prisma/client';
import { scheduledOrderOverdueAt } from '../../domain/order-time.policy';
import {
  DEPARTURE_LEAD_MINUTES,
  MINUTE,
} from '../../domain/booking-calendar.policy';
import {
  presentReview,
  publicReviewSelect,
} from '../reviews/order-review.presenter';
const ADDRESS_VISIBLE_STATUSES = new Set<ServiceOrderStatus>([
  ServiceOrderStatus.ACCEPTED,
  ServiceOrderStatus.EN_ROUTE,
  ServiceOrderStatus.ARRIVED,
  ServiceOrderStatus.IN_PROGRESS,
  ServiceOrderStatus.COMPLETED,
  ServiceOrderStatus.PAYMENT_DISPUTE,
  ServiceOrderStatus.DISPUTED,
]);

export const orderViewInclude = {
  provider: {
    select: {
      id: true,
      userId: true,
      displayName: true,
      avatarUrl: true,
      serviceRadiusKm: true,
    },
  },
  customer: { select: { id: true, fullName: true, phone: true } },
  providerService: {
    select: {
      id: true,
      serviceId: true,
      service: {
        select: {
          id: true,
          iconUrl: true,
          coverImageUrl: true,
          category: { select: { code: true, iconUrl: true } },
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
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
    select: publicReviewSelect,
  },
  contactAttempts: {
    select: { attemptedAt: true },
    orderBy: { attemptedAt: 'asc' as const },
  },
  rescheduleRequests: {
    select: {
      id: true,
      requestedByRole: true,
      status: true,
      proposedStartAt: true,
      proposedEndAt: true,
      expiresAt: true,
      createdAt: true,
      respondedAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  addOns: {
    select: {
      id: true,
      providerServiceId: true,
      serviceName: true,
      priceAmount: true,
      durationMinutes: true,
      commissionAmount: true,
      proposedTotalAmount: true,
      proposedEndAt: true,
      confirmedEndAt: true,
      note: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      respondedAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ServiceOrderInclude;

export const createdOrderInclude = {
  provider: orderViewInclude.provider,
  customer: orderViewInclude.customer,
  providerService: orderViewInclude.providerService,
  statusHistory: orderViewInclude.statusHistory,
} satisfies Prisma.ServiceOrderInclude;

export const orderInclude = {
  ...orderViewInclude,
  provider: {
    select: { ...orderViewInclude.provider.select, wallet: true },
  },
  walletHold: true,
} satisfies Prisma.ServiceOrderInclude;

export const providerOrderViewInclude = {
  ...orderViewInclude,
  walletHold: { select: { amount: true, status: true } },
} satisfies Prisma.ServiceOrderInclude;

// Pending orders cannot yet have work evidence, reviews, add-ons or reschedules.
export const pendingOrderInclude = {
  ...createdOrderInclude,
  walletHold: providerOrderViewInclude.walletHold,
} satisfies Prisma.ServiceOrderInclude;

type CreatedOrderRecord = Prisma.ServiceOrderGetPayload<{
  include: typeof createdOrderInclude;
}>;

type OrderViewRecord = Prisma.ServiceOrderGetPayload<{
  include: typeof orderViewInclude;
}>;

type PresentableOrderRecord = CreatedOrderRecord &
  Partial<
    Pick<
      OrderViewRecord,
      | 'rescheduleRequests'
      | 'addOns'
      | 'evidence'
      | 'cancellationRequest'
      | 'review'
      | 'contactAttempts'
    >
  >;

export type OrderRecord = Prisma.ServiceOrderGetPayload<{
  include: typeof orderInclude;
}>;

export function presentForCustomer(order: PresentableOrderRecord) {
  return {
    ...presentPublicOrder(order),
    customerAddressId: order.customerAddressId,
    customer: order.customer,
    provider: presentProvider(order.provider),
    ...(order.providerDisplayName
      ? {
          provider: {
            ...presentProvider(order.provider),
            displayName: order.providerDisplayName,
            avatarUrl: order.providerAvatarUrl,
          },
        }
      : {}),
    statusHistory: presentHistory(order),
  };
}

export function presentForProvider(
  order: PresentableOrderRecord & {
    walletHold?: { amount: number; status: WalletHoldStatus } | null;
  },
) {
  const canSeeAddress = ADDRESS_VISIBLE_STATUSES.has(order.status);
  return {
    ...presentPublicOrder(order),
    commissionAmount: order.commissionAmount,
    commissionRateBps: order.commissionRateBps,
    commissionHold: order.walletHold
      ? { amount: order.walletHold.amount, status: order.walletHold.status }
      : null,
    addressLabel: canSeeAddress ? order.addressLabel : null,
    addressLine: canSeeAddress ? order.addressLine : null,
    addressStreetLine: canSeeAddress ? order.addressStreetLine : null,
    addressLatitude: canSeeAddress ? order.addressLatitude : null,
    addressLongitude: canSeeAddress ? order.addressLongitude : null,
    contactName: canSeeAddress ? order.contactName : null,
    contactPhone: canSeeAddress ? order.contactPhone : null,
    addressNote: canSeeAddress ? order.addressNote : null,
    customerNote: canSeeAddress ? order.customerNote : null,
    provider: presentProvider(order.provider),
    ...(order.providerDisplayName
      ? {
          provider: {
            ...presentProvider(order.provider),
            displayName: order.providerDisplayName,
            avatarUrl: order.providerAvatarUrl,
          },
        }
      : {}),
    customer: {
      id: order.customer.id,
      fullName: order.customer.fullName,
      phone: canSeeAddress ? order.customer.phone : null,
    },
    statusHistory: presentHistory(order),
  };
}

function presentPublicOrder(order: PresentableOrderRecord) {
  return {
    id: order.id,
    bookingGroupId: order.bookingGroupId,
    bookingAttempt: order.bookingAttempt,
    customerId: order.customerId,
    providerId: order.providerId,
    providerServiceId: order.providerServiceId,
    assignedMemberId: order.assignedMemberId ?? null,
    assignedMember: order.assignedMemberId
      ? {
          id: order.assignedMemberId,
          displayName: order.assignedMemberName,
          avatarUrl: order.assignedMemberAvatarUrl,
        }
      : null,
    cashCollectedAt: order.cashCollectedAt ?? null,
    cashCollectedAmount: order.cashCollectedAmount ?? null,
    conversationId: order.conversationId,
    bookingType: order.bookingType,
    scheduledAt: order.scheduledAt,
    departureAvailableAt:
      order.bookingType === 'SCHEDULED' && order.scheduledAt
        ? new Date(
            order.scheduledAt.getTime() - DEPARTURE_LEAD_MINUTES * MINUTE,
          )
        : null,
    expectedStartAt: order.expectedStartAt,
    scheduleOverdueAt: scheduledOrderOverdueAt(order),
    expectedEndAt: order.expectedEndAt,
    status: order.status,
    paymentMethod: order.paymentMethod,
    serviceName: order.serviceName,
    serviceIconUrl:
      order.providerService?.service?.iconUrl ??
      order.providerService?.service?.coverImageUrl ??
      order.providerService?.service?.category?.iconUrl ??
      order.providerService?.service?.category?.code ??
      null,
    servicePriceAmount: order.servicePriceAmount,
    travelFeeAmount: order.travelFeeAmount,
    travelDistanceKm: order.travelDistanceKm,
    distanceSource: order.distanceSource,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    voucherCode: order.voucherCode,
    voucherIssuer: order.voucherIssuer,
    platformFundedAmount: order.platformFundedAmount,
    providerFundedAmount: order.providerFundedAmount,
    totalAmount: order.totalAmount,
    currencyCode: order.currencyCode,
    durationMinutes: order.durationMinutes,
    addressLabel: order.addressLabel,
    addressLine: order.addressLine,
    addressProvinceName: order.addressProvinceName,
    addressDistrictName: order.addressDistrictName,
    addressWardName: order.addressWardName,
    addressStreetLine: order.addressStreetLine,
    addressLatitude: order.addressLatitude,
    addressLongitude: order.addressLongitude,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    addressNote: order.addressNote,
    customerNote: order.customerNote,
    providerResponseDeadlineAt: order.providerResponseDeadlineAt,
    rescheduleRequest: order.rescheduleRequests?.[0] ?? null,
    addOns: order.addOns ?? [],
    acceptedAt: order.acceptedAt,
    enRouteAt: order.enRouteAt,
    arrivedAt: order.arrivedAt,
    arrivalDistanceMeters: order.arrivalDistanceMeters,
    arrivalAccuracyMeters: order.arrivalAccuracyMeters,
    paymentDisputeReason: order.paymentDisputeReason,
    paymentDisputeOpenedAt: order.paymentDisputeOpenedAt,
    paymentDisputeDecidedAt: order.paymentDisputeDecidedAt,
    startedAt: order.startedAt,
    workPausedAt: order.workPausedAt ?? null,
    totalPausedSeconds: order.totalPausedSeconds ?? 0,
    completedAt: order.completedAt,
    rejectedAt: order.rejectedAt,
    rejectionReason: order.rejectionReason,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    providerService: order.providerService,
    evidence: order.evidence ?? [],
    cancellationRequest: order.cancellationRequest ?? null,
    review: order.review ? presentReview(order.review) : null,
    contactAttempts: order.contactAttempts ?? [],
  };
}

function presentProvider(provider: PresentableOrderRecord['provider']) {
  return {
    id: provider.id,
    displayName: provider.displayName,
    avatarUrl: provider.avatarUrl,
    serviceRadiusKm: provider.serviceRadiusKm,
  };
}

function presentHistory(order: PresentableOrderRecord) {
  return order.statusHistory.map((history) => ({
    id: history.id,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    reason: history.reason,
    createdAt: history.createdAt,
  }));
}
