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
        serviceInterests: { select: { serviceId: true } },
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
    const serviceIds = new Set(
      profile.serviceInterests.map((item) => item.serviceId),
    );
    const personalized =
      categoryIds.size > 0 ||
      serviceIds.size > 0 ||
      profile.preferredAudience !== ServiceTargetAudience.ALL;

    const recommendations = services
      .map((service) => {
        let score = 0;
        const reasons: string[] = [];

        if (serviceIds.has(service.id)) {
          score += 100;
          reasons.push('SERVICE_INTEREST');
        }
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
      })
      .sort((left, right) => {
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
      })
      .slice(0, query.limit ?? 20)
      .map(({ sortOrder, categoryId, ...service }) => {
        void sortOrder;
        void categoryId;
        return service;
      });

    return {
      success: true,
      data: {
        personalized,
        services: recommendations,
      },
    };
  }
}
