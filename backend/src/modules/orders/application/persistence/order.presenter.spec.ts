import {
  presentForCustomer,
  presentForProvider,
  type OrderRecord,
} from './order.presenter';

describe('order privacy projections', () => {
  const order = {
    requestHash: 'private-hash',
    clientRequestId: 'private-key',
    commissionAmount: 10000,
    commissionRateBps: 1000,
    walletHold: { id: 'hold' },
    provider: {
      id: 'provider',
      userId: 'provider-account',
      wallet: { balanceAmount: 1000000 },
    },
    customer: { id: 'customer', fullName: 'Test', phone: '0900000000' },
    addressLine: 'Private address',
    addressStreetLine: 'Private street',
    addressLatitude: 21,
    addressLongitude: 105,
    contactName: 'Test',
    contactPhone: '0900000000',
    addressNote: 'Private instructions',
    statusHistory: [
      {
        id: 'history',
        actorUserId: 'customer',
        fromStatus: null,
        toStatus: 'PENDING_PROVIDER',
        createdAt: new Date(),
        reason: null,
      },
    ],
  } as unknown as OrderRecord;

  it.each(['PENDING_PROVIDER', 'REJECTED', 'EXPIRED', 'CANCELLED'] as const)(
    'hides customer location and phone in %s',
    (status) => {
      const result = presentForProvider({ ...order, status });
      expect(result).toMatchObject({
        addressLine: null,
        addressStreetLine: null,
        addressLatitude: null,
        addressLongitude: null,
        contactName: null,
        contactPhone: null,
        addressNote: null,
        customer: { phone: null },
      });
      expect(result).not.toHaveProperty('requestHash');
      expect(result).not.toHaveProperty('clientRequestId');
      expect(result.provider).not.toHaveProperty('wallet');
      expect(result.statusHistory[0]).not.toHaveProperty('actorUserId');
    },
  );

  it('exposes the accepted address only to the assigned provider projection', () => {
    expect(presentForProvider({ ...order, status: 'ACCEPTED' })).toMatchObject({
      addressLine: order.addressLine,
      contactPhone: order.contactPhone,
    });
  });

  it('does not return provider finances in a customer response', () => {
    const result = presentForCustomer(order);
    for (const field of [
      'commissionAmount',
      'commissionRateBps',
      'walletHold',
      'requestHash',
      'clientRequestId',
    ])
      expect(result).not.toHaveProperty(field);
    expect(result.provider).not.toHaveProperty('wallet');
    expect(result.provider).not.toHaveProperty('userId');
  });
});
