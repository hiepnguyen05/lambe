import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InternalRole, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { AuthenticatedInternalAccount } from '../../../internal-auth/types/authenticated-internal-account.type';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
import type { AdminOrderQueryDto } from '../../dto/admin-order-query.dto';

const listSelect = {
  id: true,
  customerId: true,
  providerId: true,
  assignedMemberId: true,
  assignedMemberName: true,
  assignedMemberAvatarUrl: true,
  providerDisplayName: true,
  bookingType: true,
  scheduledAt: true,
  expectedStartAt: true,
  expectedEndAt: true,
  status: true,
  serviceName: true,
  totalAmount: true,
  currencyCode: true,
  createdAt: true,
  updatedAt: true,
  provider: { select: { displayName: true } },
} satisfies Prisma.ServiceOrderSelect;

const staffDetailSelect = {
  ...listSelect,
  providerServiceId: true,
  paymentMethod: true,
  servicePriceAmount: true,
  travelFeeAmount: true,
  durationMinutes: true,
  addressProvinceName: true,
  addressDistrictName: true,
  addressWardName: true,
  providerResponseDeadlineAt: true,
  acceptedAt: true,
  enRouteAt: true,
  arrivedAt: true,
  startedAt: true,
  completedAt: true,
  cashCollectedByUserId: true,
  cashCollectedAt: true,
  cashCollectedAmount: true,
  rejectedAt: true,
  rejectionReason: true,
  cancelledAt: true,
  paymentDisputeReason: true,
  paymentDisputeOpenedAt: true,
  paymentDisputeDecidedAt: true,
  paymentDisputeDecisionNote: true,
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      actorUserId: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
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
  contactAttempts: {
    select: { attemptedAt: true },
    orderBy: { attemptedAt: 'asc' as const },
  },
  review: {
    select: { id: true, rating: true, comment: true, createdAt: true },
  },
} satisfies Prisma.ServiceOrderSelect;

const adminDetailSelect = {
  ...staffDetailSelect,
  commissionAmount: true,
  commissionRateBps: true,
  addressLabel: true,
  addressLine: true,
  addressStreetLine: true,
  addressLatitude: true,
  addressLongitude: true,
  addressNote: true,
  contactName: true,
  contactPhone: true,
  customerNote: true,
  customer: { select: { fullName: true, phone: true } },
} satisfies Prisma.ServiceOrderSelect;

@Injectable()
export class AdminOrderQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async list(query: AdminOrderQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException('Khoang thoi gian khong hop le.');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ServiceOrderWhereInput = {
      status: query.status,
      bookingType: query.bookingType,
      customerId: query.customerId,
      providerId: query.providerId,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceOrder.findMany({
        where,
        select: listSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);
    return {
      success: true,
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(
    id: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    const admin = actor.roles.includes(InternalRole.ADMIN);
    const order = admin
      ? await this.prisma.serviceOrder.findUnique({
          where: { id },
          select: adminDetailSelect,
        })
      : await this.prisma.serviceOrder.findUnique({
          where: { id },
          select: staffDetailSelect,
        });
    if (!order) throw new NotFoundException('Khong tim thay don hang.');
    if (admin) {
      await this.audit.record(
        {
          actorInternalAccountId: actor.accountId,
          action: 'ORDER_CONTACT_VIEWED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
      );
    }
    return {
      success: true,
      data: { ...order, timeline: this.timeline(order) },
    };
  }

  async evidenceUrl(
    orderId: string,
    evidenceId: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    const evidence = await this.prisma.orderEvidence.findFirst({
      where: { id: evidenceId, orderId },
      select: {
        id: true,
        type: true,
        capturedAt: true,
        publicId: true,
        fileFormat: true,
      },
    });
    if (!evidence) throw new NotFoundException('Khong tim thay bang chung.');
    const url = this.storage.createPrivateDownloadUrl(
      evidence.publicId,
      evidence.fileFormat,
    );
    await this.audit.record(
      {
        actorInternalAccountId: actor.accountId,
        action: 'ORDER_EVIDENCE_VIEWED',
        resourceType: 'OrderEvidence',
        resourceId: evidenceId,
        result: 'SUCCESS',
        metadata: { orderId },
      },
      request,
    );
    return {
      success: true,
      data: {
        id: evidence.id,
        type: evidence.type,
        capturedAt: evidence.capturedAt,
        url,
      },
    };
  }

  private timeline(
    order: Prisma.ServiceOrderGetPayload<{ select: typeof staffDetailSelect }>,
  ) {
    const events = [
      ...order.statusHistory.map((item) => ({
        kind: 'STATUS',
        at: item.createdAt,
        id: item.id,
        value: item.toStatus,
        reason: item.reason,
      })),
      ...order.evidence.map((item) => ({
        kind: 'EVIDENCE',
        at: item.capturedAt,
        id: item.id,
        value: item.type,
        reason: null,
      })),
      ...(order.cancellationRequest
        ? [
            {
              kind: 'CANCELLATION_REQUEST',
              at: order.cancellationRequest.requestedAt,
              id: order.cancellationRequest.id,
              value: order.cancellationRequest.status,
              reason: order.cancellationRequest.reason,
            },
          ]
        : []),
    ];
    return events.sort(
      (a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id),
    );
  }
}
