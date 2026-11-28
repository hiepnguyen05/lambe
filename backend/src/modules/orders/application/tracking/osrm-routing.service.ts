import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisCacheService } from '../../../../infrastructure/cache/redis-cache.service';

export interface TrackingRoute {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

const QUOTE_DISTANCE_TIMEOUT_MS = 800;
const QUOTE_DISTANCE_TTL_SECONDS = 300;

@Injectable()
export class OsrmRoutingService {
  private readonly logger = new Logger(OsrmRoutingService.name);

  constructor(@Optional() private readonly cache?: RedisCacheService) {}

  async getDistanceMeters(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ): Promise<number | null> {
    if (
      origin.latitude === destination.latitude &&
      origin.longitude === destination.longitude
    ) {
      return 0;
    }
    const baseUrl = process.env.OSRM_URL;
    if (!baseUrl) return null;
    const cacheKey = `lambe:osrm:distance:v1:${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}:${destination.latitude.toFixed(3)},${destination.longitude.toFixed(3)}`;
    const cached = await this.cache?.get<number>(cacheKey);
    if (typeof cached === 'number' && Number.isFinite(cached)) {
      return cached;
    }
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${baseUrl.replace(/\/$/, '')}/route/v1/driving/${coordinates}?overview=false&steps=false`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(QUOTE_DISTANCE_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      if (!isDistanceResponse(payload)) return null;
      const distance = payload.routes[0].distance;
      void this.cache?.set(cacheKey, distance, QUOTE_DISTANCE_TTL_SECONDS);
      return distance;
    } catch (error: unknown) {
      this.logger.warn(
        `OSRM distance unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ): Promise<TrackingRoute | null> {
    const baseUrl = process.env.OSRM_URL;
    if (!baseUrl) return null;
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${baseUrl.replace(/\/$/, '')}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const payload: unknown = await response.json();
      if (!isRouteResponse(payload)) return null;
      const route = payload.routes[0];
      return {
        coordinates: route.geometry.coordinates,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    } catch (error: unknown) {
      this.logger.warn(
        `OSRM route unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}

function isDistanceResponse(value: unknown): value is {
  code: string;
  routes: { distance: number }[];
} {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  if (
    payload.code !== 'Ok' ||
    !Array.isArray(payload.routes) ||
    !payload.routes.length
  )
    return false;
  const route = payload.routes[0] as Record<string, unknown>;
  return typeof route.distance === 'number' && Number.isFinite(route.distance);
}

function isRouteResponse(value: unknown): value is {
  code: string;
  routes: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
} {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  if (
    payload.code !== 'Ok' ||
    !Array.isArray(payload.routes) ||
    !payload.routes.length
  )
    return false;
  const route = payload.routes[0] as Record<string, unknown>;
  const geometry = route.geometry as Record<string, unknown> | undefined;
  return (
    typeof route.distance === 'number' &&
    Number.isFinite(route.distance) &&
    typeof route.duration === 'number' &&
    Number.isFinite(route.duration) &&
    !!geometry &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2 &&
    geometry.coordinates.every(
      (point: unknown) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every(
          (coordinate) =>
            typeof coordinate === 'number' && Number.isFinite(coordinate),
        ),
    )
  );
}
