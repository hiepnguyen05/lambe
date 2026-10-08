import { Injectable } from '@nestjs/common';
import {
  CustomerPricePreference,
  ServiceCategoryStatus,
  ServiceStatus,
  ServiceTargetAudience,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { RecommendationQueryDto } from '../dto/recommendation-query.dto';

@Injectable()
export class CustomerRecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getServices(userId: string, query: RecommendationQueryDto) {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: {
        preferredAudience: true,
        pricePreference: true,
        categoryInterests: { select: { categoryId: true } },
      },
    });
    const services = await this.prisma.service.findMany({
      where: {
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
      select: {
        id: true,
        code: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        coverImageUrl: true,
        minPriceAmount: true,
        maxPriceAmount: true,
        currencyCode: true,
        defaultDurationMinutes: true,
        targetAudience: true,
        sortOrder: true,
        categoryId: true,
        category: {
          select: { id: true, code: true, name: true, slug: true },
        },
      },
    });

    const categoryIds = new Set(
      profile.categoryInterests.map((item) => item.categoryId),
    );
    const personalized =
      categoryIds.size > 0 ||
      profile.preferredAudience !== ServiceTargetAudience.ALL;

    const rankedServices = services.map((service) => {
      let score = 0;
      const reasons: string[] = [];

      if (categoryIds.has(service.categoryId)) {
        score += 50;
        reasons.push('CATEGORY_INTEREST');
      }
      if (
        profile.preferredAudience !== ServiceTargetAudience.ALL &&
        service.targetAudience === profile.preferredAudience
      ) {
        score += 20;
        reasons.push('AUDIENCE_MATCH');
      } else if (
        profile.preferredAudience !== ServiceTargetAudience.ALL &&
        service.targetAudience === ServiceTargetAudience.ALL
      ) {
        score += 10;
        reasons.push('AVAILABLE_FOR_ALL');
      }

      return { ...service, recommendationScore: score, reasons };
    });

    rankedServices.sort((left, right) => {
      if (right.recommendationScore !== left.recommendationScore) {
        return right.recommendationScore - left.recommendationScore;
      }
      if (
        profile.pricePreference === CustomerPricePreference.BUDGET &&
        left.minPriceAmount !== right.minPriceAmount
      ) {
        return left.minPriceAmount - right.minPriceAmount;
      }
      if (
        profile.pricePreference === CustomerPricePreference.PREMIUM &&
        left.maxPriceAmount !== right.maxPriceAmount
      ) {
        return right.maxPriceAmount - left.maxPriceAmount;
      }
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.name.localeCompare(right.name, 'vi');
    });

    const limit = query.limit ?? 20;
    const recommendations = this.selectDiverseRecommendations(
      rankedServices,
      categoryIds,
      limit,
    );

    const responseServices = recommendations.map(
      ({ sortOrder, categoryId, ...service }) => {
        void sortOrder;
        void categoryId;
        return service;
      },
    );

    return {
      success: true,
      data: {
        personalized,
        services: responseServices,
      },
    };
  }

  private selectDiverseRecommendations<
    T extends { id: string; categoryId: string },
  >(ranked: T[], categoryIds: Set<string>, limit: number): T[] {
    if (categoryIds.size === 0) {
      return this.takeDiverseByCategory(ranked, limit);
    }

    const preferred = ranked.filter((item) => categoryIds.has(item.categoryId));
    const discovery = ranked.filter(
      (item) => !categoryIds.has(item.categoryId),
    );
    const preferredTarget = Math.ceil(limit * 0.75);
    const discoveryTarget = limit - preferredTarget;
    const preferredItems = this.takeDiverseByCategory(
      preferred,
      preferredTarget,
    );
    const discoveryItems = this.takeDiverseByCategory(
      discovery,
      discoveryTarget,
    );
    const selected = this.interleaveDiscovery(
      preferredItems,
      discoveryItems,
      limit,
    );

    if (selected.length >= limit) return selected;

    const selectedIds = new Set(selected.map((item) => item.id));
    const remaining = ranked.filter((item) => !selectedIds.has(item.id));
    return [
      ...selected,
      ...this.takeDiverseByCategory(remaining, limit - selected.length),
    ];
  }

  private takeDiverseByCategory<T extends { categoryId: string }>(
    ranked: T[],
    limit: number,
  ): T[] {
    if (limit <= 0) return [];

    const groups = new Map<string, T[]>();
    for (const item of ranked) {
      const group = groups.get(item.categoryId);
      if (group) group.push(item);
      else groups.set(item.categoryId, [item]);
    }

    const result: T[] = [];
    while (result.length < limit && groups.size > 0) {
      for (const [categoryId, items] of groups) {
        const item = items.shift();
        if (item) result.push(item);
        if (items.length === 0) groups.delete(categoryId);
        if (result.length === limit) break;
      }
    }
    return result;
  }

  private interleaveDiscovery<T>(
    preferred: T[],
    discovery: T[],
    limit: number,
  ): T[] {
    const result: T[] = [];
    let preferredIndex = 0;
    let discoveryIndex = 0;

    while (result.length < limit) {
      for (let index = 0; index < 3 && result.length < limit; index += 1) {
        const item = preferred[preferredIndex++];
        if (item) result.push(item);
      }

      const discoveryItem = discovery[discoveryIndex++];
      if (discoveryItem && result.length < limit) result.push(discoveryItem);

      if (
        preferredIndex >= preferred.length &&
        discoveryIndex >= discovery.length
      ) {
        break;
      }
    }
    return result;
  }
}
