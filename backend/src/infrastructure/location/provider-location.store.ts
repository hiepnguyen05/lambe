export const PROVIDER_LOCATION_STORE = Symbol('PROVIDER_LOCATION_STORE');

export interface ProviderLocationPoint {
  providerId: string;
  distanceKm: number;
}

export interface ProviderPosition {
  providerId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAtMs: number;
  sequence: number;
}

export interface ProviderLocationStore {
  getPosition(
    providerId: string,
  ): Promise<{ latitude: number; longitude: number } | null>;
  upsert(position: ProviderPosition): Promise<boolean>;
  remove(providerId: string): Promise<void>;
  isOnline(providerId: string): Promise<boolean>;
  findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): Promise<ProviderLocationPoint[]>;
}
