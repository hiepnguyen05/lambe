import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  ProviderServiceChangeStatus,
  ProviderServiceChangeType,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import { ProviderServiceChangesService } from './provider-service-changes.service';

function context() {
  const provider = {
    id: 'provider-id',
    userId: 'owner-id',
    status: 'ACTIVE',
    sourceApplicationId: 'application-id',
  };
  const row = {
    id: 'request-id',
    providerId: provider.id,
    serviceId: 'service-id',
    proposedPriceAmount: 120_000,
    status: ProviderServiceChangeStatus.DRAFT,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: provider.id }]),
    providerProfile: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(provider),
    },
    providerService: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    providerServiceChangeRequest: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({
        ...row,
        status: ProviderServiceChangeStatus.PENDING_REVIEW,
      }),
    },
    service: {
      findFirst: jest.fn().mockResolvedValue({
        minPriceAmount: 50_000,
        maxPriceAmount: 200_000,
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      }),
    },
    providerApplication: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (arg: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { record: jest.fn() };
  const notifications = { enqueue: jest.fn() };
  const changes = new ProviderServiceChangesService(
    prisma as never,
    audit as never,
    notifications as never,
  );
  return { changes, tx, provider, notifications, audit };
}

describe('provider service changes', () => {
  it('creates a draft for an active catalog service within its price range', async () => {
    const { changes, tx } = context();
    await changes.create(
      'owner-id',
      {
        type: ProviderServiceChangeType.ADD_EXISTING_SERVICE,
        serviceId: 'service-id',
        proposedPriceAmount: 120_000,
      },
      {},
    );
    const createCalls = tx.providerServiceChangeRequest.create.mock
      .calls as unknown as Array<
      [
        {
          data: {
            providerId: string;
            serviceId: string;
            type: ProviderServiceChangeType;
          };
        },
      ]
    >;
    expect(createCalls[0][0].data).toMatchObject({
      providerId: 'provider-id',
      serviceId: 'service-id',
      type: ProviderServiceChangeType.ADD_EXISTING_SERVICE,
    });
  });

  it('submits only an owned editable request and enqueues notification', async () => {
    const { changes, tx, notifications, audit } = context();
    await changes.submit('owner-id', 'request-id', {});
    expect(tx.providerServiceChangeRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'request-id', providerId: 'provider-id' },
    });
    const updateCalls = tx.providerServiceChangeRequest.update.mock
      .calls as unknown as Array<
      [{ data: { status: ProviderServiceChangeStatus } }]
    >;
    expect(updateCalls[0][0].data.status).toBe(
      ProviderServiceChangeStatus.PENDING_REVIEW,
    );
    expect(notifications.enqueue).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects a submission for a suspended provider', async () => {
    const { changes, tx, provider } = context();
    provider.status = 'SUSPENDED';
    await expect(changes.submit('owner-id', 'request-id', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.providerServiceChangeRequest.update).not.toHaveBeenCalled();
  });

  it('does not resubmit a request that is already under review', async () => {
    const { changes, tx } = context();
    tx.providerServiceChangeRequest.findFirst.mockResolvedValue({
      status: ProviderServiceChangeStatus.PENDING_REVIEW,
    });
    await expect(changes.submit('owner-id', 'request-id', {})).rejects.toThrow(
      ConflictException,
    );
    expect(tx.providerServiceChangeRequest.update).not.toHaveBeenCalled();
  });
});
