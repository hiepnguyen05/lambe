import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceOrderStatus } from '@prisma/client';
import { ObservabilityMetrics } from '../../../../infrastructure/observability/observability-metrics.service';
import { OrderTrackingService } from './order-tracking.service';

describe('OrderTrackingService', () => {
  const order = {
    id: 'order-1',
    customerId: 'customer-1',
    providerId: 'provider-1',
    status: ServiceOrderStatus.EN_ROUTE,
    addressLatitude: 21.0285,
    addressLongitude: 105.8542,
    provider: { userId: 'provider-user-1' },
  };
  const prisma = { serviceOrder: { findFirst: jest.fn() } };
  const cache = {
    getTracking: jest.fn(),
    saveTrackingIfNewer: jest.fn<Promise<boolean>, [string, unknown]>(),
  };
  const routing = { getRoute: jest.fn() };
  let metrics: ObservabilityMetrics;
  let service: OrderTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.serviceOrder.findFirst.mockResolvedValue(order);
    cache.getTracking.mockResolvedValue(null);
    cache.saveTrackingIfNewer.mockResolvedValue(true);
    routing.getRoute.mockResolvedValue(null);
    metrics = new ObservabilityMetrics();
    service = new OrderTrackingService(
      prisma as never,
      cache as never,
      routing as never,
      metrics,
    );
  });

  it('rejects GPS from a user who does not own the provider order', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.update('stranger', order.id, {
        latitude: 21.02,
        longitude: 105.85,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(cache.saveTrackingIfNewer).not.toHaveBeenCalled();
  });

  it('rejects GPS once the provider is no longer en route', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      ...order,
      status: ServiceOrderStatus.ARRIVED,
    });
    await expect(
      service.update('provider-user-1', order.id, {
        latitude: 21.02,
        longitude: 105.85,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects stale positions before writing to Redis', async () => {
    await expect(
      service.update('provider-user-1', order.id, {
        latitude: 21.02,
        longitude: 105.85,
        accuracyMeters: 10,
        capturedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cache.saveTrackingIfNewer).not.toHaveBeenCalled();
    expect(metrics.snapshot().events['tracking.gps'].stale).toBe(1);
  });

  it('returns no provider position when the order is not en route', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      ...order,
      status: ServiceOrderStatus.ARRIVED,
    });
    expect(
      await service.getCustomerSnapshot('customer-1', order.id),
    ).toMatchObject({
      status: 'INACTIVE',
      position: null,
      route: null,
    });
    expect(cache.getTracking).not.toHaveBeenCalled();
  });

  it('does not expose tracking to another customer', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.getCustomerSnapshot('other-customer', order.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not label an old GPS position as live', async () => {
    cache.getTracking.mockResolvedValue({
      capturedAtMs: Date.now() - 25_000,
      position: { latitude: 21.02, longitude: 105.85 },
      route: { coordinates: [] },
    });
    await expect(
      service.getCustomerSnapshot('customer-1', order.id),
    ).resolves.toEqual({
      status: 'WAITING_FOR_LOCATION',
      position: null,
      route: null,
    });
  });

  it('stores and returns the latest real position', async () => {
    const capturedAt = new Date().toISOString();
    const result = await service.update('provider-user-1', order.id, {
      latitude: 21.02,
      longitude: 105.85,
      accuracyMeters: 10,
      capturedAt,
    });
    expect(result.accepted).toBe(true);
    expect(metrics.snapshot().events['tracking.gps'].accepted).toBe(1);
    const saved: unknown = cache.saveTrackingIfNewer.mock.calls[0]?.[1];
    expect(saved).toMatchObject({
      position: { latitude: 21.02, longitude: 105.85 },
    });
  });

  it('returns the same road route to the provider after publishing GPS', async () => {
    const route = {
      coordinates: [
        [105.85, 21.02],
        [105.855, 21.025],
        [105.8542, 21.0285],
      ],
      distanceMeters: 1700,
      durationSeconds: 360,
    };
    routing.getRoute.mockResolvedValue(route);

    const result = await service.update('provider-user-1', order.id, {
      latitude: 21.02,
      longitude: 105.85,
      accuracyMeters: 10,
      capturedAt: new Date().toISOString(),
    });

    expect(result).toMatchObject({
      accepted: true,
      tracking: {
        status: 'LIVE',
        position: { latitude: 21.02, longitude: 105.85 },
        route,
      },
    });
  });

  it('does not overwrite a newer GPS sample with an older one', async () => {
    cache.getTracking.mockResolvedValue({ capturedAtMs: Date.now() + 1000 });
    expect(
      await service.update('provider-user-1', order.id, {
        latitude: 21.02,
        longitude: 105.85,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      }),
    ).toEqual({ accepted: false });
    expect(cache.saveTrackingIfNewer).not.toHaveBeenCalled();
    expect(metrics.snapshot().events['tracking.gps']['out-of-order']).toBe(1);
  });
});
