export const PROVIDER_LOCATION_STORE = Symbol('PROVIDER_LOCATION_STORE');

export interface ProviderLocationPoint {
  providerId: string;
  distanceKm: number;
}

export interface ProviderLocationStore {
  upsert(
    providerId: string,
    latitude: number,
    longitude: number,
  ): Promise<void>;
  remove(providerId: string): Promise<void>;
  isOnline(providerId: string): Promise<boolean>;
  findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): Promise<ProviderLocationPoint[]>;
}
