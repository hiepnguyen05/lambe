import { createHash } from 'node:crypto';
import { OrderBookingService } from './order-booking.service';

describe('OrderBookingService performance & 30s SLA', () => {
  it('sets a 30s provider response deadline and notifies recipient immediately on commit', async () => {
    const nowBefore = Date.now();
    const createdOrder = {
      id: 'order-1',
      bookingGroupId: 'grp-1',
      bookingAttempt: 1,
      customerId: 'cust-1',
      providerId: 'prv-1',
      providerServiceId: 'ps-1',
      assignedMemberId: null,
      assignedMemberName: null,
      assignedMemberAvatarUrl: null,
      assignedMemberUserId: null,
      providerDisplayName: 'Thợ A',
      providerAvatarUrl: null,
      cashCollectedAt: null,
      cashCollectedAmount: null,
      conversationId: 'conv-1',
      bookingType: 'ASAP',
      scheduledAt: null,
      expectedStartAt: new Date(nowBefore + 60_000),
      expectedEndAt: new Date(nowBefore + 3_660_000),
      status: 'PENDING_PROVIDER',
      paymentMethod: 'CASH',
      serviceName: 'Làm móng',
      servicePriceAmount: 150_000,
      travelFeeAmount: 0,
      travelDistanceKm: 1.5,
      distanceSource: 'OSRM',
      subtotalAmount: 150_000,
      discountAmount: 0,
      voucherCode: null,
      voucherIssuer: null,
      platformFundedAmount: 0,
      providerFundedAmount: 0,
      totalAmount: 150_000,
      currencyCode: 'VND',
      durationMinutes: 60,
      addressLabel: 'Nhà',
      addressLine: '123 Lê Lợi',
      addressProvinceName: null,
      addressDistrictName: null,
      addressWardName: null,
      addressStreetLine: null,
      addressLatitude: 10.7731,
      addressLongitude: 106.703,
      contactName: 'Minh',
      contactPhone: '0912345678',
      addressNote: null,
      customerNote: null,
      providerResponseDeadlineAt: new Date(nowBefore + 30_000),
      acceptedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      arrivalDistanceMeters: null,
      arrivalAccuracyMeters: null,
      paymentDisputeReason: null,
      paymentDisputeOpenedAt: null,
      paymentDisputeDecidedAt: null,
      startedAt: null,
      completedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      providerService: { id: 'ps-1', serviceId: 'srv-1' },
      provider: {
        id: 'prv-1',
        displayName: 'Thợ A',
        avatarUrl: null,
        serviceRadiusKm: 10,
      },
      customer: { id: 'cust-1', fullName: 'Minh', phone: '0912345678' },
      statusHistory: [],
    };

    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: '1' }]),
      serviceOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(createdOrder),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ fullName: 'Minh', phone: '0912345678' }),
      },
      orderNotification: {
        create: jest.fn().mockResolvedValue({ id: 'notice-1' }),
      },
    };

    const prisma = {
      providerService: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ providerId: 'prv-1', serviceId: 'srv-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (client: typeof tx) => unknown) => cb(tx)),
    };

    const preparedAddress = {
      id: 'addr-1',
      label: 'Nhà',
      addressLine: '123 Lê Lợi',
      latitude: 10.7731,
      longitude: 106.703,
      provinceName: null,
      districtName: null,
      wardName: null,
      streetLine: null,
      contactName: 'Minh',
      contactPhone: '0912345678',
      note: null,
    };

    const eligibility = {
      captureOrigin: jest.fn().mockResolvedValue({
        providerId: 'prv-1',
        latitude: 10.7731,
        longitude: 106.703,
        observedAt: Date.now(),
      }),
      prepare: jest.fn().mockResolvedValue({
        address: preparedAddress,
        providerService: {
          id: 'ps-1',
          providerId: 'prv-1',
          serviceId: 'srv-1',
          provider: {
            id: 'prv-1',
            userId: 'provider-user-1',
            displayName: 'Thợ A',
            avatarUrl: null,
            serviceRadiusKm: 10,
            wallet: { balanceAmount: 200_000, heldAmount: 0 },
          },
          service: {
            id: 'srv-1',
            iconUrl: null,
            coverImageUrl: null,
            category: { code: 'NAIL', iconUrl: null },
            name: 'Làm móng',
            currencyCode: 'VND',
            minPriceAmount: 100_000,
          },
        },
        memberContext: null,
        serviceTime: new Date(nowBefore + 60_000),
        reservedStartAt: new Date(nowBefore),
        expectedEndAt: new Date(nowBefore + 3_660_000),
        durationMinutes: 60,
        commissionAmount: 15_000,
        commissionRateBps: 1000,
        servicePriceAmount: 150_000,
        travelOrigin: { latitude: 10.7731, longitude: 106.703 },
        available: true,
        reason: null,
        suggestedSlots: [],
      }),
      assertAvailable: jest.fn(),
      canReceiveNewOrder: jest.fn().mockReturnValue(true),
    };

    const chat = {
      attachOrder: jest.fn().mockResolvedValue('conv-1'),
      notifyOrderAttached: jest.fn(),
    };
    const notificationRelay = {
      publishNow: jest.fn().mockResolvedValue(undefined),
    };

    const jwt = {
      verifyAsync: jest.fn().mockImplementation(() => {
        const requestHash = createHash('sha256')
          .update(
            JSON.stringify({
              providerServiceId: 'ps-1',
              memberId: null,
              customerAddressId: 'addr-1',
              inlineAddress: null,
              bookingType: 'ASAP',
              scheduledAt: null,
              voucherCode: null,
            }),
          )
          .digest('hex');
        const addressHash = createHash('sha256')
          .update(
            JSON.stringify([
              'Nhà',
              '123 Lê Lợi',
              10.7731,
              106.703,
              null,
              null,
              null,
              null,
              null,
            ]),
          )
          .digest('hex');
        return Promise.resolve({
          purpose: 'booking-quote',
          customerId: 'cust-1',
          memberId: null,
          membershipVersion: null,
          requestHash,
          providerPriceAmount: 150_000,
          travelDistanceKm: 1.5,
          distanceSource: 'OSRM',
          travelFeeAmount: 0,
          totalAmount: 150_000,
          origin: { latitude: 10.7731, longitude: 106.703 },
          addressHash,
        });
      }),
    };

    const service = new OrderBookingService(
      prisma as never,
      eligibility as never,
      {
        lockProvider: jest.fn().mockResolvedValue(undefined),
        releaseExpired: jest.fn().mockResolvedValue(undefined),
      } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      chat as never,
      {
        price: jest.fn().mockResolvedValue({
          subtotalAmount: 150_000,
          discountAmount: 0,
          voucherCode: null,
          voucherIssuer: null,
          voucherId: null,
          platformFundedAmount: 0,
          providerFundedAmount: 0,
          totalAmount: 150_000,
          commissionAmount: 15_000,
        }),
      } as never,
      {} as never,
      jwt as never,
      undefined,
      notificationRelay as never,
    );

    const res = await service.create(
      'cust-1',
      {
        providerServiceId: 'ps-1',
        customerAddressId: 'addr-1',
        bookingType: 'ASAP',
        quoteToken: 'valid-jwt',
      } as never,
      {},
      'idempotency-12345',
    );

    expect(res.success).toBe(true);
    expect(res.data.customer).toEqual({
      id: 'cust-1',
      fullName: 'Minh',
      phone: '0912345678',
    });
    expect(res.data.provider).toEqual({
      id: 'prv-1',
      displayName: 'Thợ A',
      avatarUrl: null,
      serviceRadiusKm: 10,
    });
    expect(res.data.providerService).toEqual({
      id: 'ps-1',
      serviceId: 'srv-1',
      service: {
        id: 'srv-1',
        iconUrl: null,
        coverImageUrl: null,
        category: { code: 'NAIL', iconUrl: null },
      },
    });
    expect(res.data.provider).not.toHaveProperty('wallet');
    const createCalls = tx.serviceOrder.create.mock.calls as unknown as Array<
      [{ data: { providerResponseDeadlineAt: Date } }]
    >;
    const createCall = createCalls[0][0];
    const deadlineMs = createCall.data.providerResponseDeadlineAt.getTime();
    expect(deadlineMs - nowBefore).toBeGreaterThanOrEqual(28_000);
    expect(deadlineMs - nowBefore).toBeLessThanOrEqual(35_000);
    expect(chat.attachOrder).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        id: createdOrder.id,
        conversationId: 'conv-1',
      }),
      expect.objectContaining({
        providerUserId: 'provider-user-1',
        isNewOrder: true,
      }),
    );
    expect(notificationRelay.publishNow).toHaveBeenCalledWith(
      'provider-user-1',
      'notice-1',
    );
  });
});
