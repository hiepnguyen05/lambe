import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BookingType,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceOrderStatus,
} from '@prisma/client';
import { ProviderServicesService } from './provider-services.service';

function context() {
  const offering = {
    id: 'offering-id',
    providerId: 'provider-id',
    status: ProviderServiceStatus.ACTIVE,
    priceAmount: 100_000,
    service: {
      status: 'ACTIVE',
      minPriceAmount: 50_000,
      maxPriceAmount: 200_000,
      category: { status: 'ACTIVE' },
    },
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'provider-id' }]),
    providerProfile: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'provider-id',
        status: ProviderProfileStatus.ACTIVE,
        setupCompletedAt: new Date(),
      }),
    },
    providerService: {
      findFirst: jest.fn().mockResolvedValue(offering),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...offering,
          status: ProviderServiceStatus.INACTIVE,
        }),
      ),
    },
    serviceOrder: { count: jest.fn().mockResolvedValue(0) },
    providerAvailabilitySession: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (arg: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { record: jest.fn() };
  const notifications = { enqueueSuspension: jest.fn() };
  const locations = { remove: jest.fn().mockResolvedValue(undefined) };
  const service = new ProviderServicesService(
    prisma as never,
    audit as never,
    notifications as never,
    locations as never,
  );
  return { service, tx, offering, locations, audit };
}

describe('provider offering availability', () => {
  it('closes the online session and location when the last service is paused', async () => {
    const { service, tx, locations, audit } = context();
    await service.setAvailability('owner', 'offering-id', false, {});
    const updates = tx.providerService.update.mock.calls as unknown as Array<
      [{ data: { status: ProviderServiceStatus } }]
    >;
    expect(updates[0][0].data.status).toBe(ProviderServiceStatus.INACTIVE);
    const sessions = tx.providerAvailabilitySession.updateMany.mock
      .calls as unknown as Array<[{ data: { endReason: string } }]>;
    expect(sessions[0][0].data.endReason).toBe('NO_ACTIVE_SERVICE');
    expect(locations.remove).toHaveBeenCalledWith('provider-id');
    expect(audit.record).toHaveBeenCalled();
  });

  it('requires a response to a pending immediate order before pausing', async () => {
    const { service, tx, locations } = context();
    tx.serviceOrder.count.mockResolvedValue(1);
    await expect(
      service.setAvailability('owner', 'offering-id', false, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    const counts = tx.serviceOrder.count.mock.calls as unknown as Array<
      [
        {
          where: {
            providerServiceId: string;
            status: ServiceOrderStatus;
            bookingType: BookingType;
          };
        },
      ]
    >;
    expect(counts[0][0].where).toMatchObject({
      providerServiceId: 'offering-id',
      status: ServiceOrderStatus.PENDING_PROVIDER,
      bookingType: BookingType.ASAP,
    });
    expect(tx.providerService.update).not.toHaveBeenCalled();
    expect(locations.remove).not.toHaveBeenCalled();
  });

  it('does not mutate a service outside the provider account', async () => {
    const { service, tx } = context();
    tx.providerService.findFirst.mockResolvedValue(null);
    await expect(
      service.setAvailability('owner', 'foreign-id', false, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.providerService.update).not.toHaveBeenCalled();
  });
});
