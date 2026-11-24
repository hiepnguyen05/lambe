import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { VoucherService } from './voucher.service';

describe('VoucherService pricing', () => {
  const context = {
    providerId: 'provider',
    serviceId: 'service',
    servicePriceAmount: 200000,
    serviceFloorAmount: 100000,
    travelFeeAmount: 12000,
  };
  const voucher = {
    id: 'voucher',
    code: 'LAMBE20',
    issuer: 'PLATFORM',
    providerId: null,
    serviceId: null,
    discountType: 'PERCENTAGE',
    value: 20,
    maxDiscountAmount: 30000,
    minOrderAmount: 100000,
    startsAt: new Date('2026-10-01'),
    endsAt: new Date('2026-11-01'),
    status: 'ACTIVE',
    usageLimit: 2,
    perCustomerLimit: 1,
  };
  const tx = {
    voucher: {
      findUnique: jest.fn().mockResolvedValue(voucher),
      findUniqueOrThrow: jest.fn().mockResolvedValue(voucher),
    },
    voucherRedemption: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const service = new VoucherService(
    tx as never,
    { record: jest.fn() } as never,
  );
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-19'));
    tx.voucherRedemption.count.mockReset().mockResolvedValue(0);
    tx.voucher.findUnique.mockResolvedValue(voucher);
  });
  afterEach(() => jest.useRealTimers());

  it('keeps travel outside discount and commission unchanged for platform voucher', async () => {
    const price = await service.price('customer', 'lambe20', context);
    expect(price).toMatchObject({
      subtotalAmount: 212000,
      discountAmount: 30000,
      totalAmount: 182000,
      platformFundedAmount: 30000,
      commissionAmount: 20000,
    });
  });

  it('serializes reservation and rejects exhausted vouchers', async () => {
    tx.voucherRedemption.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    await expect(
      service.price('customer', 'LAMBE20', context, tx as never, true),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('enforces per-customer usage and provider/service scope', async () => {
    tx.voucherRedemption.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    await expect(
      service.price('customer', 'LAMBE20', context),
    ).rejects.toBeInstanceOf(ConflictException);
    tx.voucher.findUnique.mockResolvedValueOnce({
      ...voucher,
      providerId: 'other',
    });
    await expect(
      service.price('customer', 'LAMBE20', context),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reduces commission base for a provider-funded discount', async () => {
    tx.voucher.findUnique.mockResolvedValueOnce({
      ...voucher,
      issuer: 'PROVIDER',
      providerId: 'provider',
      value: 10,
    });
    const price = await service.price('customer', 'LAMBE20', context);
    expect(price).toMatchObject({
      discountAmount: 20000,
      providerFundedAmount: 20000,
      platformFundedAmount: 0,
      commissionAmount: 18000,
      totalAmount: 192000,
    });
  });

  it('does not let one provider disable another provider voucher', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const audit = { record: jest.fn() };
    const prisma = {
      providerProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'own-provider' }),
      },
      $transaction: jest.fn((callback: (transaction: unknown) => unknown) =>
        callback({ voucher: { updateMany } }),
      ),
    };
    const guarded = new VoucherService(prisma as never, audit as never);
    await expect(
      guarded.disable('PROVIDER', 'owner', 'voucher-id', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'voucher-id',
        issuer: 'PROVIDER',
        providerId: 'own-provider',
      },
      data: { status: 'INACTIVE' },
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('scopes and filters the platform voucher list', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const listed = new VoucherService(
      { voucher: { findMany, count } } as never,
      { record: jest.fn() } as never,
    );
    await listed.list('PLATFORM', 'admin', {
      page: 1,
      limit: 20,
      search: 'lambe',
      status: 'ACTIVE',
      activeAt: '2026-10-19T00:00:00.000Z',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuer: 'PLATFORM',
          providerId: undefined,
          code: { contains: 'lambe', mode: 'insensitive' },
          status: 'ACTIVE',
          startsAt: { lte: new Date('2026-10-19T00:00:00.000Z') },
          endsAt: { gt: new Date('2026-10-19T00:00:00.000Z') },
        },
      }),
    );
    const countCalls = count.mock.calls as unknown as Array<
      [{ where: { issuer?: string } }]
    >;
    expect(countCalls[0][0].where.issuer).toBe('PLATFORM');
  });
});
