import { ConflictException } from '@nestjs/common';
import { BookingCalendarService } from './booking-calendar.service';

describe('booking calendar lifecycle checks', () => {
  const now = new Date('2026-10-12T06:30:00Z');
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it('keeps overrunning and stale accepted orders blocking, without losing manual time off', async () => {
    const row = {
      id: 'block',
      orderId: 'order',
      providerId: 'provider',
      startAt: new Date('2026-10-12T04:00:00Z'),
      endAt: new Date('2026-10-12T05:00:00Z'),
      addressLatitude: 21,
      addressLongitude: 105,
    };
    const prisma = {
      orderRescheduleRequest: { findMany: jest.fn().mockResolvedValue([]) },
      providerCalendarBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...row,
            order: {
              status: 'IN_PROGRESS',
              startedAt: row.startAt,
              durationMinutes: 60,
            },
          },
          {
            ...row,
            orderId: 'other',
            order: { status: 'ACCEPTED', startedAt: null, durationMinutes: 60 },
          },
          { ...row, orderId: null, order: null },
        ]),
      },
    };
    const service = new BookingCalendarService(prisma as never);
    const result = (
      await service.read(
        ['provider'],
        now,
        new Date('2026-10-12T18:00:00Z'),
        now,
        prisma as never,
        'excluded',
      )
    ).get('provider')!;
    expect(result[0]).toMatchObject({
      endAt: new Date('2026-10-12T07:00:00Z'),
      executing: true,
      estimated: true,
    });
    expect(result[1]).toMatchObject({
      endAt: new Date('2026-10-12T07:00:00Z'),
      executing: false,
      estimated: true,
    });
    expect(result[2].endAt).toEqual(row.endAt);
    const calls = prisma.providerCalendarBlock.findMany.mock.calls as [
      { where: { AND: unknown[] } },
    ][];
    const query = calls[0][0];
    expect(query.where.AND).toContainEqual({
      OR: [{ orderId: null }, { orderId: { not: 'excluded' } }],
    });
  });

  it('uses actual service start when it ends later than the original estimate', async () => {
    const prisma = {
      orderRescheduleRequest: { findMany: jest.fn().mockResolvedValue([]) },
      providerCalendarBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            providerId: 'provider',
            startAt: new Date('2026-10-12T06:00:00Z'),
            endAt: new Date('2026-10-12T07:00:00Z'),
            order: {
              status: 'IN_PROGRESS',
              startedAt: new Date('2026-10-12T06:20:00Z'),
              durationMinutes: 60,
            },
            addressLatitude: null,
            addressLongitude: null,
          },
        ]),
      },
    };
    const service = new BookingCalendarService(prisma as never);
    const result = await service.read(
      ['provider'],
      now,
      new Date('2026-10-12T18:00:00Z'),
      now,
    );
    expect(result.get('provider')![0].endAt).toEqual(
      new Date('2026-10-12T07:20:00Z'),
    );
  });

  it('blocks another booking while a customer reschedule proposal is pending', async () => {
    const proposedStartAt = new Date('2026-10-12T08:00:00Z');
    const prisma = {
      providerCalendarBlock: { findMany: jest.fn().mockResolvedValue([]) },
      orderRescheduleRequest: {
        findMany: jest.fn().mockResolvedValue([
          {
            proposedStartAt,
            proposedEndAt: new Date('2026-10-12T09:00:00Z'),
            order: {
              providerId: 'provider',
              addressLatitude: 21,
              addressLongitude: 105,
            },
          },
        ]),
      },
    };
    const blocks = await new BookingCalendarService(prisma as never).read(
      ['provider'],
      now,
      new Date('2026-10-12T18:00:00Z'),
      now,
    );
    expect(blocks.get('provider')).toEqual([
      {
        startAt: proposedStartAt,
        endAt: new Date('2026-10-12T09:00:00Z'),
        point: { latitude: 21, longitude: 105 },
      },
    ]);
    const calls = prisma.orderRescheduleRequest.findMany.mock
      .calls as unknown as [
      {
        where: {
          status: string;
          expiresAt: { gt: Date };
          order: { status: string };
        };
      },
    ][];
    expect(calls[0][0].where.status).toBe('PENDING');
    expect(calls[0][0].where.expiresAt.gt).toEqual(now);
    expect(calls[0][0].where.order.status).toBe('ACCEPTED');
  });

  it('keeps a safety-held order blocking the provider calendar', async () => {
    const prisma = {
      orderRescheduleRequest: { findMany: jest.fn().mockResolvedValue([]) },
      providerCalendarBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            providerId: 'provider',
            startAt: new Date('2026-10-12T04:00:00Z'),
            endAt: new Date('2026-10-12T05:00:00Z'),
            order: {
              status: 'SAFETY_HOLD',
              startedAt: null,
              durationMinutes: 60,
            },
            addressLatitude: null,
            addressLongitude: null,
          },
        ]),
      },
    };
    const service = new BookingCalendarService(prisma as never);
    const blocks = await service.read(
      ['provider'],
      now,
      new Date('2026-10-12T18:00:00Z'),
      now,
    );
    expect(blocks.get('provider')![0]).toMatchObject({
      executing: true,
      estimated: true,
    });
  });

  it('rejects early departure and concurrent execution, but permits departure once the previous job finishes', async () => {
    const prisma = {
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'other' }) },
    };
    const service = new BookingCalendarService(prisma as never);
    await expect(
      service.assertCanDepart(
        prisma as never,
        'provider',
        'order',
        new Date('2026-10-12T09:00:00Z'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.serviceOrder.findFirst).not.toHaveBeenCalled();
    await expect(
      service.assertCanDepart(prisma as never, 'provider', 'order', now),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.assertCanDepart(prisma as never, 'provider', 'order', now),
    ).resolves.toBeUndefined();
  });
});
