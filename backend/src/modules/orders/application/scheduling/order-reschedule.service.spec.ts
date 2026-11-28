import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DecideOrderRescheduleDto } from '../../dto/order.dto';
import { OrderRescheduleService } from './order-reschedule.service';

describe('order reschedule decisions', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  const requestId = 'aaaabbbb-1111-4111-8111-111122223333';
  const proposal = {
    id: requestId,
    orderId: 'order',
    status: 'PENDING',
    proposedStartAt: new Date('2026-11-02T04:00:00Z'),
    proposedEndAt: new Date('2026-11-02T05:00:00Z'),
    expiresAt: new Date('2026-11-02T00:30:00Z'),
  };
  function fixture() {
    const order = {
      id: 'order',
      providerId: 'provider',
      customerId: 'customer',
      providerServiceId: 'service',
      assignedMemberId: null,
      status: 'ACCEPTED',
      bookingType: 'SCHEDULED',
      durationMinutes: 60,
      expectedStartAt: new Date('2026-11-02T02:00:00Z'),
      addressLatitude: 21,
      addressLongitude: 105,
      provider: {
        userId: 'worker',
        workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          startMinute: 0,
          endMinute: 1440,
        })),
      },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
        update: jest.fn(),
      },
      providerCalendarBlock: { update: jest.fn() },
      orderOperationalAlert: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderRescheduleRequest: {
        findFirst: jest
          .fn()
          .mockImplementation((args: { where: { id?: string } }) =>
            Promise.resolve(
              args.where.id && args.where.id !== requestId ? null : proposal,
            ),
          ),
        update: jest
          .fn()
          .mockImplementation((args: { data: object }) =>
            Promise.resolve({ ...proposal, ...args.data }),
          ),
      },
      orderNotification: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((work: (t: typeof tx) => unknown) => work(tx)),
    };
    const calendar = {
      lockProvider: jest.fn(),
      read: jest.fn().mockResolvedValue(new Map([['provider', []]])),
    };
    const audit = { record: jest.fn() };
    const service = new OrderRescheduleService(
      prisma as never,
      calendar as never,
      audit as never,
      {} as never,
    );
    return { service, tx, calendar };
  }
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it('does not decide a newer request when the visible ID no longer matches', async () => {
    const { service, tx } = fixture();
    await expect(
      service.decide(
        'worker',
        'order',
        { requestId: 'ccccdddd-1111-4111-8111-111122223333', approve: true },
        {},
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.orderRescheduleRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ccccdddd-1111-4111-8111-111122223333',
        orderId: 'order',
        status: 'PENDING',
        expiresAt: { gt: now },
      },
    });
    expect(tx.serviceOrder.update).not.toHaveBeenCalled();
    expect(tx.orderRescheduleRequest.update).not.toHaveBeenCalled();
  });
  it('acceptance updates order and calendar only after conflict recheck', async () => {
    const { service, tx, calendar } = fixture();
    await service.decide('worker', 'order', { requestId, approve: true }, {});
    expect(calendar.lockProvider).toHaveBeenCalled();
    expect(calendar.read).toHaveBeenCalled();
    expect(tx.serviceOrder.update).toHaveBeenCalledWith({
      where: { id: 'order' },
      data: {
        scheduledAt: proposal.proposedStartAt,
        expectedStartAt: proposal.proposedStartAt,
        expectedEndAt: proposal.proposedEndAt,
      },
    });
    expect(tx.providerCalendarBlock.update).toHaveBeenCalled();
    expect(tx.orderNotification.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer',
        orderId: 'order',
        event: 'ORDER_RESCHEDULE_ACCEPTED',
      },
    });
  });
  it('a slot occupied after the proposal rejects acceptance without changing the order', async () => {
    const { service, tx, calendar } = fixture();
    calendar.read.mockResolvedValue(
      new Map([
        [
          'provider',
          [
            {
              startAt: proposal.proposedStartAt,
              endAt: proposal.proposedEndAt,
            },
          ],
        ],
      ]),
    );
    await expect(
      service.decide('worker', 'order', { requestId, approve: true }, {}),
    ).rejects.toThrow(ConflictException);
    expect(tx.serviceOrder.update).not.toHaveBeenCalled();
    expect(tx.orderRescheduleRequest.update).not.toHaveBeenCalled();
  });
  it('rejection retains the order and calendar times', async () => {
    const { service, tx } = fixture();
    await service.decide('worker', 'order', { requestId, approve: false }, {});
    expect(tx.serviceOrder.update).not.toHaveBeenCalled();
    expect(tx.providerCalendarBlock.update).not.toHaveBeenCalled();
    expect(tx.orderRescheduleRequest.update).toHaveBeenCalledWith({
      where: { id: requestId, status: 'PENDING', expiresAt: { gt: now } },
      data: { status: 'REJECTED', respondedAt: now },
    });
  });
  it('keeps serving-account ownership and active-state checks', async () => {
    const { service, tx } = fixture();
    tx.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.decide('stranger', 'order', { requestId, approve: true }, {}),
    ).rejects.toThrow(NotFoundException);
    expect(tx.orderRescheduleRequest.findFirst).not.toHaveBeenCalled();
  });
  it('validates optional requestId while preserving the old boolean contract', async () => {
    expect(
      await validate(
        plainToInstance(DecideOrderRescheduleDto, {
          requestId,
          approve: false,
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(DecideOrderRescheduleDto, { approve: true }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(DecideOrderRescheduleDto, {
          requestId: 'bad-id',
          approve: 'true',
        }),
      ),
    ).toHaveLength(2);
  });
});
