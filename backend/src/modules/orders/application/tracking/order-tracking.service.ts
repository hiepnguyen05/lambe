import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceOrderStatus } from '@prisma/client';
import { RedisCacheService } from '../../../../infrastructure/cache/redis-cache.service';
import { ObservabilityMetrics } from '../../../../infrastructure/observability/observability-metrics.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { OrderLocationDto } from '../../dto/order-location.dto';
import { OsrmRoutingService, type TrackingRoute } from './osrm-routing.service';
import {
  assertAssignedMemberActive,
  servingOrderWhere,
} from '../persistence/order-actor.policy';

interface TrackingSnapshot {
  capturedAtMs: number;
  position: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: string;
    headingDegrees?: number;
  };
  route: TrackingRoute | null;
  routeOrigin: { latitude: number; longitude: number } | null;
  routeCalculatedAtMs: number | null;
}

@Injectable()
export class OrderTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly routing: OsrmRoutingService,
    private readonly metrics: ObservabilityMetrics,
  ) {}

  async update(userId: string, orderId: string, location: OrderLocationDto) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, ...servingOrderWhere(userId) },
      select: {
        status: true,
        assignedMemberId: true,
        assignedMemberVersion: true,
        assignedMemberUserId: true,
        addressLatitude: true,
        addressLongitude: true,
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await assertAssignedMemberActive(this.prisma, order, userId);
    if (order.status !== ServiceOrderStatus.EN_ROUTE) {
      throw new ConflictException(
        'Chỉ gửi vị trí khi đang di chuyển tới khách.',
      );
    }
    const capturedAtMs = Date.parse(location.capturedAt);
    const now = Date.now();
    if (
      !Number.isFinite(capturedAtMs) ||
      capturedAtMs < now - 30_000 ||
      capturedAtMs > now + 10_000
    ) {
      this.metrics.recordEvent('tracking.gps', 'stale');
      throw new ConflictException(
        'Vị trí GPS đã cũ hoặc thời gian thiết bị không hợp lệ.',
      );
    }

    const previous = await this.cache.getTracking<TrackingSnapshot>(orderId);
    if (previous && previous.capturedAtMs >= capturedAtMs) {
      this.metrics.recordEvent('tracking.gps', 'out-of-order');
      return { accepted: false };
    }
    const origin = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const routeAgeMs =
      previous?.routeCalculatedAtMs == null
        ? Infinity
        : now - previous.routeCalculatedAtMs;
    const movedMeters = previous?.routeOrigin
      ? distanceMeters(previous.routeOrigin, origin)
      : Infinity;
    const refreshRoute = routeAgeMs >= 30_000 || movedMeters >= 200;
    const route = refreshRoute
      ? await this.routing.getRoute(origin, {
          latitude: order.addressLatitude,
          longitude: order.addressLongitude,
        })
      : (previous?.route ?? null);
    const snapshot: TrackingSnapshot = {
      capturedAtMs,
      position: {
        ...origin,
        accuracyMeters: location.accuracyMeters,
        capturedAt: location.capturedAt,
        ...(location.headingDegrees == null
          ? {}
          : { headingDegrees: location.headingDegrees }),
      },
      route,
      routeOrigin: refreshRoute ? origin : (previous?.routeOrigin ?? null),
      routeCalculatedAtMs: refreshRoute
        ? now
        : (previous?.routeCalculatedAtMs ?? null),
    };
    const accepted = await this.cache.saveTrackingIfNewer(orderId, snapshot);
    this.metrics.recordEvent(
      'tracking.gps',
      accepted ? 'accepted' : 'out-of-order',
    );
    return accepted
      ? {
          accepted: true,
          tracking: {
            status: 'LIVE',
            position: snapshot.position,
            route: snapshot.route,
          },
        }
      : { accepted: false };
  }

  async getCustomerSnapshot(customerId: string, orderId: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, customerId },
      select: { status: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    if (order.status !== ServiceOrderStatus.EN_ROUTE) {
      return { status: 'INACTIVE', position: null, route: null };
    }
    const snapshot = await this.cache.getTracking<TrackingSnapshot>(orderId);
    return snapshot && Date.now() - snapshot.capturedAtMs < 20_000
      ? { status: 'LIVE', position: snapshot.position, route: snapshot.route }
      : { status: 'WAITING_FOR_LOCATION', position: null, route: null };
  }

  subscribe(orderId: string, listener: () => void) {
    return this.cache.subscribeTracking(orderId, listener);
  }
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const radians = Math.PI / 180;
  const deltaLatitude = (b.latitude - a.latitude) * radians;
  const deltaLongitude = (b.longitude - a.longitude) * radians;
  const arc =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(arc)));
}
