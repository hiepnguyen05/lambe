import { Injectable, Logger } from '@nestjs/common';

export interface TrackingRoute {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

@Injectable()
export class OsrmRoutingService {
  private readonly logger = new Logger(OsrmRoutingService.name);

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
