import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  CustomerOnboardingStatus,
  CustomerPricePreference,
  ProviderType,
  ServiceTargetAudience,
} from '@prisma/client';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';
import {
  discoveryAreaCacheKey,
  discoveryOnboardingCacheKey,
  discoveryProviderSummaryCacheKey,
  jitterTtlSeconds,
} from '../../../common/cache/discovery-cache.keys';

export interface CachedCustomerOnboarding {
  onboardingStatus: CustomerOnboardingStatus;
  preferredAudience: ServiceTargetAudience;
  pricePreference: CustomerPricePreference;
  categoryIds: string[];
  serviceIds: string[];
}

export interface CachedAreaCandidate {
  providerId: string;
  serviceAreaLatitude: number;
  serviceAreaLongitude: number;
  serviceRadiusKm: number;
}

export interface CachedProviderServiceOffering {
  id: string;
  priceAmount: number;
  durationMinutes: number | null;
  description: string | null;
  service: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
    targetAudience: ServiceTargetAudience;
    defaultDurationMinutes: number;
    categoryId: string;
  };
}

export interface CachedProviderSummary {
  id: string;
  userId: string;
  providerType: ProviderType;
  displayName: string;
  avatarUrl: string | null;
  biography: string | null;
  experienceYears: number | null;
  serviceAreaName: string | null;
  serviceRadiusKm: number | null;
  workingHours: Array<{
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
  wallet: { balanceAmount: number; heldAmount: number } | null;
  services: CachedProviderServiceOffering[];
}

const ONBOARDING_TTL_SECONDS = 300;
const AREA_TTL_SECONDS = 120;
const PROVIDER_SUMMARY_TTL_SECONDS = 90;

@Injectable()
export class DiscoveryCacheService {
  constructor(
    @Optional() @Inject(CACHE_STORE) private readonly cache?: CacheStore,
  ) {}

  async getOnboarding(userId: string): Promise<CachedCustomerOnboarding | null> {
    if (!this.cache) return null;
    try {
      return await this.cache.get<CachedCustomerOnboarding>(
        discoveryOnboardingCacheKey(userId),
      );
    } catch {
      return null;
    }
  }

  async setOnboarding(
    userId: string,
    value: CachedCustomerOnboarding,
  ): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.set(
        discoveryOnboardingCacheKey(userId),
        value,
        ONBOARDING_TTL_SECONDS,
      );
    } catch {
      // Fail-open: ignore cache write errors.
    }
  }

  async invalidateOnboarding(userId: string): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.delete(discoveryOnboardingCacheKey(userId));
    } catch {
      // Fail-open.
    }
  }

  async getAreaCandidates(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<CachedAreaCandidate[] | null> {
    if (!this.cache) return null;
    try {
      return await this.cache.get<CachedAreaCandidate[]>(
        discoveryAreaCacheKey(latitude, longitude, radiusKm),
      );
    } catch {
      return null;
    }
  }

  async setAreaCandidates(
    latitude: number,
    longitude: number,
    radiusKm: number,
    rows: CachedAreaCandidate[],
  ): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.set(
        discoveryAreaCacheKey(latitude, longitude, radiusKm),
        rows,
        jitterTtlSeconds(AREA_TTL_SECONDS),
      );
    } catch {
      // Fail-open.
    }
  }

  async getProviderSummaries(
    providerIds: string[],
  ): Promise<Map<string, CachedProviderSummary>> {
    const result = new Map<string, CachedProviderSummary>();
    if (!this.cache || !providerIds.length) return result;
    try {
      const keys = providerIds.map(discoveryProviderSummaryCacheKey);
      const entries = await this.cache.getMany<CachedProviderSummary>(keys);
      entries.forEach((entry, index) => {
        if (entry) result.set(providerIds[index], entry);
      });
    } catch {
      // Fail-open: callers query DB for missing entries.
    }
    return result;
  }

  async setProviderSummaries(entries: CachedProviderSummary[]): Promise<void> {
    if (!this.cache || !entries.length) return;
    try {
      await Promise.all(
        entries.map((entry) =>
          this.cache!.set(
            discoveryProviderSummaryCacheKey(entry.id),
            entry,
            jitterTtlSeconds(PROVIDER_SUMMARY_TTL_SECONDS),
          ),
        ),
      );
    } catch {
      // Fail-open.
    }
  }
}

