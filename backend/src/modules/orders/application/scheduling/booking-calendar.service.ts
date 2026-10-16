import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  DAY,
  MINUTE,
  OVERRUN_MINUTES,
  type BusyInterval,
} from '../../domain/booking-calendar.policy';

const executingStatuses: ServiceOrderStatus[] = [
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
];
const blockSelect = {
  id: true,
  orderId: true,
  providerId: true,
  startAt: true,
  endAt: true,
  addressLatitude: true,
  addressLongitude: true,
  reason: true,
  holdExpiresAt: true,
  order: { select: { status: true, startedAt: true, durationMinutes: true } },
} satisfies Prisma.ProviderCalendarBlockSelect;

@Injectable()
export class BookingCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async lockProvider(tx: Prisma.TransactionClient, providerId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${providerId} FOR UPDATE`,
    );
  }

  async releaseExpired(
    tx: Prisma.TransactionClient,
    providerId: string,
    now: Date,
  ) {
    const expired = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "service_orders" WHERE "providerId" = ${providerId}
        AND "status" = 'PENDING_PROVIDER' AND "providerResponseDeadlineAt" <= ${now}
      FOR UPDATE`);
    if (!expired.length) return;
    const ids = expired.map((order) => order.id);
    await tx.serviceOrder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'EXPIRED' },
    });
    await tx.providerCalendarBlock.updateMany({
      where: { orderId: { in: ids }, active: true },
      data: { active: false },
    });
    await tx.orderStatusHistory.createMany({
      data: ids.map((orderId) => ({
        orderId,
        fromStatus: ServiceOrderStatus.PENDING_PROVIDER,
        toStatus: ServiceOrderStatus.EXPIRED,
        reason: 'PROVIDER_RESPONSE_TIMEOUT',
      })),
    });
    const owners = await tx.serviceOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, customerId: true },
    });
    await tx.orderNotification.createMany({
      data: owners.map((order) => ({
        userId: order.customerId,
        orderId: order.id,
        event: 'ORDER_EXPIRED',
      })),
    });
  }

  async read(
    providerIds: string[],
    start: Date,
    end: Date,
    now = new Date(),
    tx: Prisma.TransactionClient = this.prisma,
    excludeOrderId?: string,
  ) {
    if (!providerIds.length) return new Map<string, BusyInterval[]>();
    const rows = await tx.providerCalendarBlock.findMany({
      where: {
        providerId: { in: providerIds },
        active: true,
        ...(excludeOrderId
          ? { OR: [{ orderId: null }, { orderId: { not: excludeOrderId } }] }
          : {}),
        AND: [
          { OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
          {
            OR: [
              {
                startAt: { lt: new Date(end.getTime() + DAY) },
                endAt: { gt: new Date(start.getTime() - DAY) },
              },
              {
                order: {
                  status: {
                    in: [...executingStatuses, ServiceOrderStatus.ACCEPTED],
                  },
                },
                endAt: { lte: now },
              },
            ],
          },
        ],
      },
      select: blockSelect,
      orderBy: { startAt: 'asc' },
    });
    const grouped = new Map<string, BusyInterval[]>();
    for (const row of rows) {
      const executing =
        !!row.order && executingStatuses.includes(row.order.status);
      const unfinished =
        !!row.order && (executing || row.order.status === 'ACCEPTED');
      let endAt = row.endAt;
      if (row.order?.startedAt && row.order.status === 'IN_PROGRESS') {
        endAt = new Date(
          Math.max(
            endAt.getTime(),
            row.order.startedAt.getTime() + row.order.durationMinutes * MINUTE,
          ),
        );
      }
      if (unfinished && endAt <= now)
        endAt = new Date(now.getTime() + OVERRUN_MINUTES * MINUTE);
      const block: BusyInterval = {
        startAt: row.startAt,
        endAt,
        executing,
        estimated: executing || endAt.getTime() !== row.endAt.getTime(),
        point:
          row.addressLatitude !== null && row.addressLongitude !== null
            ? { latitude: row.addressLatitude, longitude: row.addressLongitude }
            : undefined,
      };
      const list = grouped.get(row.providerId) ?? [];
      list.push(block);
      grouped.set(row.providerId, list);
    }
    return grouped;
  }

  async release(tx: Prisma.TransactionClient, orderId: string) {
    await tx.providerCalendarBlock.updateMany({
      where: { orderId, active: true },
      data: { active: false },
    });
  }

  async assertCanDepart(
    tx: Prisma.TransactionClient,
    providerId: string,
    orderId: string,
    expectedStartAt: Date,
  ) {
    if (expectedStartAt.getTime() - Date.now() > 60 * MINUTE) {
      throw new ConflictException({
        code: 'TOO_EARLY_TO_DEPART',
        message: 'Chỉ có thể khởi hành trong vòng 60 phút trước lịch hẹn.',
      });
    }
    const other = await tx.serviceOrder.findFirst({
      where: {
        providerId,
        id: { not: orderId },
        status: { in: executingStatuses },
      },
      select: { id: true },
    });
    if (other)
      throw new ConflictException({
        code: 'PROVIDER_BUSY',
        message: 'Hãy hoàn thành đơn hiện tại trước khi khởi hành.',
      });
  }
}
