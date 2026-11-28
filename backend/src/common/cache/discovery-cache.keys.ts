export const DISCOVERY_CACHE_PREFIX = 'lambe:discovery:v1:';

export const discoveryOnboardingCacheKey = (userId: string) =>
  `${DISCOVERY_CACHE_PREFIX}onboarding:${userId}`;

export const discoveryProviderSummaryCacheKey = (providerId: string) =>
  `${DISCOVERY_CACHE_PREFIX}provider-summary:${providerId}`;

/**
 * Quantizes coordinates to ~0.005 degrees (~550m) so nearby GPS requests share
 * the spatial area cell cache while keeping final distance exact per request.
 */
export const quantizeDiscoveryCoord = (value: number) =>
  (Math.round(value * 200) / 200).toFixed(3);

export const discoveryAreaCacheKey = (
  latitude: number,
  longitude: number,
  radiusKm: number,
) =>
  `${DISCOVERY_CACHE_PREFIX}area:${quantizeDiscoveryCoord(latitude)}:${quantizeDiscoveryCoord(longitude)}:r${radiusKm}`;

export const jitterTtlSeconds = (baseSeconds: number) => {
  const spread = Math.max(1, Math.round(baseSeconds * 0.1));
  const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread;
  return Math.max(5, baseSeconds + delta);
};

