import { Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AiRecommendationsService } from './ai-recommendations.service';
import type { AiConsultationResult } from './ai-consultation.service';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class AiRecommendationRefreshService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendations: AiRecommendationsService,
  ) {}

  async refresh(result: AiConsultationResult) {
    return (await this.refreshMany([result]))[0];
  }

  // One set of queries for the whole history page, rather than a query per message/card.
  async refreshMany(results: AiConsultationResult[]) {
    if (!results.length) return [];
    const serviceIds = [
      ...new Set(
        results.flatMap((r) => (r.suggestedServices ?? []).map((s) => s.id)),
      ),
    ];
    const postIds = [
      ...new Set(
        results.flatMap((r) => (r.suggestedPosts ?? []).map((p) => p.id)),
      ),
    ];
    const providerServiceIds = [
      ...new Set(
        results.flatMap((r) =>
          (r.suggestedProviders ?? []).flatMap((p) => {
            const id = object(object(p).service).id;
            return typeof id === 'string' ? [id] : [];
          }),
        ),
      ),
    ];
    const [services, providerServices, posts] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          id: { in: serviceIds },
          status: 'ACTIVE',
          category: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          minPriceAmount: true,
          maxPriceAmount: true,
          currencyCode: true,
        },
      }),
      this.prisma.providerService.findMany({
        where: {
          id: { in: providerServiceIds },
          status: 'ACTIVE',
          provider: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
          service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
        },
        select: {
          id: true,
          providerId: true,
          priceAmount: true,
          durationMinutes: true,
          provider: { select: { displayName: true, avatarUrl: true } },
          service: {
            select: { id: true, name: true, slug: true, currencyCode: true },
          },
        },
      }),
      postIds.length
        ? this.recommendations.posts(serviceIds, postIds)
        : Promise.resolve([]),
    ]);
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const providerMap = new Map(providerServices.map((s) => [s.id, s]));
    const postMap = new Map(posts.map((p) => [p.id, p]));
    return results.map((result) => {
      const suggestedServices = (result.suggestedServices ?? []).flatMap(
        (s) => serviceMap.get(s.id) ?? [],
      );
      const activeIds = new Set(suggestedServices.map((s) => s.id));
      const suggestedPosts = (result.suggestedPosts ?? []).flatMap((p) => {
        const current = postMap.get(p.id);
        return current && activeIds.has(current.service.id) ? [current] : [];
      });
      const suggestedProviders = (result.suggestedProviders ?? []).flatMap(
        (value) => {
          const provider = object(value),
            service = object(provider.service);
          const current =
            typeof service.id === 'string'
              ? providerMap.get(service.id)
              : undefined;
          if (
            !current ||
            current.providerId !== provider.id ||
            !activeIds.has(current.service.id)
          )
            return [];
          return [
            {
              ...provider,
              ...current.provider,
              service: {
                ...service,
                id: current.id,
                priceAmount: current.priceAmount,
                durationMinutes: current.durationMinutes,
                service: { ...object(service.service), ...current.service },
              },
            },
          ];
        },
      );
      const nextActions = (result.nextActions ?? []).filter((action) => {
        switch (action.type) {
          case 'VIEW_SERVICE':
          case 'FIND_PROVIDER':
            return (
              !!action.targetId &&
              activeIds.has(action.targetId) &&
              (action.type !== 'FIND_PROVIDER' || suggestedProviders.length > 0)
            );
          case 'VIEW_INSPIRATION':
            return suggestedPosts.some((p) => p.id === action.targetId);
          case 'CREATE_QUOTE':
            return suggestedProviders.length > 0;
          case 'SELECT_ADDRESS':
          case 'SELECT_BOOKING_TIME':
            return activeIds.size > 0;
          default:
            return false;
        }
      });
      const changed = !isDeepStrictEqual(
        [
          result.suggestedServices ?? [],
          result.suggestedProviders ?? [],
          result.suggestedPosts ?? [],
        ],
        [suggestedServices, suggestedProviders, suggestedPosts],
      );
      return {
        ...result,
        suggestedServices,
        suggestedProviders,
        suggestedPosts,
        nextActions,
        suggestionsExpired: changed,
        conversionPrompt: activeIds.size ? result.conversionPrompt : null,
        nextAction: !activeIds.size
          ? ('CONTINUE_CONSULTATION' as const)
          : result.nextAction === 'SHOW_PROVIDERS' && !suggestedProviders.length
            ? ('REQUEST_BOOKING_TIME' as const)
            : result.nextAction,
      };
    });
  }
}
