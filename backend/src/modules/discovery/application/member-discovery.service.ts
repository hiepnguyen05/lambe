import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEMBER_LOCATION_STORE,
  type MemberLocationStore,
} from '../../../infrastructure/location/member-location.store';
import { MemberServingService } from '../../provider-members/application/booking/member-serving.service';
import { presentMemberOffering } from '../../provider-members/application/capabilities/member-service-eligibility';
import { BookingCalendarService } from '../../orders/application/scheduling/booking-calendar.service';
import { OrderEligibilityService } from '../../orders/application/order-eligibility.service';
import {
  assessSlot,
  suggestSlots,
  DAY,
  MINUTE,
  travelMinutes,
  PREPARATION_MINUTES,
  ASAP_RESPONSE_MINUTES,
  SCHEDULE_LEAD_MINUTES,
} from '../../orders/domain/booking-calendar.policy';
import { resolveOrderTime } from '../../orders/domain/order-time.policy';
import {
  estimateTravelDistanceKm,
  calculateTravelFee,
} from '../../orders/domain/travel-fee.policy';
import { ScheduledProviderCandidatesService } from './scheduled-provider-candidates.service';
import type { ProviderSearchDto } from '../dto/provider-search.dto';
import { OrderReviewService } from '../../orders/application/reviews/order-review.service';
import type { ReviewSummary } from '../../orders/application/reviews/order-review.presenter';

@Injectable()
export class MemberDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serving: MemberServingService,
    private readonly calendar: BookingCalendarService,
    private readonly scheduled: ScheduledProviderCandidatesService,
    private readonly eligibility: OrderEligibilityService,
    @Inject(MEMBER_LOCATION_STORE)
    private readonly locations: MemberLocationStore,
    private readonly reviews: OrderReviewService,
  ) {}

  async search(
    userId: string,
    dto: ProviderSearchDto,
    origin: { latitude: number; longitude: number },
    excluded?: ReadonlySet<string>,
  ) {
    const now = new Date(),
      type = dto.bookingType ?? 'ASAP',
      at = resolveOrderTime(type, dto.scheduledAt, now);
    const nearby =
      type === 'SCHEDULED'
        ? await this.scheduled.findMembers(
            dto.serviceId,
            origin.latitude,
            origin.longitude,
            dto.radiusKm ?? 10,
          )
        : await this.locations.findNearbyMembers(
            origin.latitude,
            origin.longitude,
            dto.radiusKm ?? 10,
            300,
          );
    const candidates = nearby.filter(
      (c) => !dto.memberId || c.memberId === dto.memberId,
    );
    const contexts = await this.serving.loadMany(
      candidates.map((c) => c.memberId),
      { serviceId: dto.serviceId },
      now,
      new Date(at.getTime() + DAY),
    );
    const resources = new Map(
      contexts.map((c) => [c.member.id, c.member.providerId]),
    );
    const blocks = await this.calendar.read(
      [...new Set(resources.values())],
      now,
      new Date(at.getTime() + DAY),
      now,
      this.prisma,
      undefined,
      resources,
    );
    const sessions =
      type === 'ASAP' && candidates.length
        ? await this.prisma.providerMemberAvailabilitySession.findMany({
            where: {
              OR: candidates.flatMap((c) =>
                'sessionId' in c
                  ? [{ memberId: c.memberId, id: c.sessionId }]
                  : [],
              ),
              endedAt: null,
              lastHeartbeatAt: {
                gt: new Date(now.getTime() - this.serving.ttl * 1000),
              },
            },
            select: { memberId: true, membershipVersion: true },
          })
        : [];
    const sessionVersions = new Map(
      sessions.map((s) => [s.memberId, s.membershipVersion]),
    );
    const distances = new Map(
      candidates.map((c) => [c.memberId, c.distanceKm]),
    );
    const summaries = await this.reviews.memberSummaries(
      contexts.map((c) => c.member.id),
    );
    const data = contexts.flatMap((c) => {
      const m = c.member,
        provider = m.provider,
        distanceKm = distances.get(m.id);
      if (
        distanceKm === undefined ||
        !c.radiusKm ||
        distanceKm > c.radiusKm ||
        m.userId === userId ||
        provider.userId === userId ||
        (dto.providerId && provider.id !== dto.providerId) ||
        excluded?.has(`${provider.id}:${m.id}`)
      )
        return [];
      if (type === 'ASAP' && sessionVersions.get(m.id) !== m.membershipVersion)
        return [];
      const durationMinutes =
        c.offering.durationMinutes ??
        c.offering.service.defaultDurationMinutes ??
        60;
      const startAt =
        type === 'ASAP'
          ? new Date(
              now.getTime() +
                (ASAP_RESPONSE_MINUTES +
                  travelMinutes(distanceKm) +
                  PREPARATION_MINUTES) *
                  MINUTE,
            )
          : at;
      if (
        this.serving.blocker(
          c,
          new Date(startAt.getTime() + durationMinutes * MINUTE),
        ) ||
        !this.eligibility.canReceiveNewOrder(
          provider.wallet,
          Math.ceil(c.offering.priceAmount / 10),
        )
      )
        return [];
      const busy = [
        ...(blocks.get(m.id) ?? []),
        ...c.timeOffs.map((t) => ({ startAt: t.startAt, endAt: t.endAt })),
      ];
      const assessment = assessSlot({
        startAt,
        durationMinutes,
        hours: c.hours,
        blocks: busy,
        point: origin,
        reservationStartAt: type === 'ASAP' ? now : undefined,
      });
      const available =
        assessment.available &&
        !(type === 'ASAP' && busy.some((b) => 'executing' in b && b.executing));
      const estimate = estimateTravelDistanceKm(distanceKm),
        member = this.serving.publicIdentity(c);
      const suggestions = available
        ? []
        : suggestSlots({
            startAt: new Date(
              Math.max(
                startAt.getTime(),
                now.getTime() + SCHEDULE_LEAD_MINUTES * MINUTE,
              ),
            ),
            until: new Date(
              Math.min(now.getTime() + 30 * DAY, at.getTime() + DAY),
            ),
            durationMinutes,
            hours: c.hours,
            blocks: busy,
            point: origin,
            limit: 3,
          });
      return [
        {
          id: provider.id,
          providerId: provider.id,
          memberId: m.id,
          member,
          reviewSummary: summaries.get(m.id)!,
          organization: {
            id: provider.id,
            displayName: provider.displayName,
            avatarUrl: provider.avatarUrl,
          },
          providerType: 'ORGANIZATION' as const,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          biography: provider.biography,
          experienceYears: member.experienceYears,
          serviceAreaName: provider.serviceAreaName,
          distanceKm: Math.round(distanceKm * 10) / 10,
          estimatedTravelDistanceKm: estimate,
          estimatedTravelFeeAmount: calculateTravelFee(estimate),
          available,
          reason: available ? null : (assessment.reason ?? 'PROVIDER_BUSY'),
          expectedStartAt: startAt,
          expectedEndAt: new Date(startAt.getTime() + durationMinutes * MINUTE),
          requiresProviderConfirmation: true,
          estimateSource: 'CONSERVATIVE_DISTANCE',
          service: {
            id: c.offering.id,
            priceAmount: c.offering.priceAmount,
            durationMinutes,
            description: c.offering.description,
            service: {
              id: c.offering.service.id,
              name: c.offering.service.name,
              slug: c.offering.service.slug,
              currencyCode: c.offering.service.currencyCode,
              targetAudience: c.offering.service.targetAudience,
              defaultDurationMinutes: c.offering.service.defaultDurationMinutes,
            },
          },
          suggestedSlots: suggestions,
        },
      ];
    });
    return { data, searchLimited: nearby.length >= 300 };
  }

  async publicMembers(providerId: string, memberId?: string) {
    const candidates = await this.prisma.providerMember.findMany({
      where: {
        ...(memberId ? { id: memberId } : {}),
        providerId,
        status: 'ACTIVE',
        canProvideServices: true,
        provider: {
          status: 'ACTIVE',
          providerType: 'ORGANIZATION',
          user: { status: 'ACTIVE' },
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 50,
    });
    const contexts = await this.serving.loadMany(
      candidates.map((c) => c.id),
      {},
      new Date(),
      new Date(Date.now() + DAY),
    );
    const summaries = await this.reviews.memberSummaries(
      contexts.map((c) => c.member.id),
    );
    const grouped = new Map<
      string,
      {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        experienceYears: number;
        reviewSummary: ReviewSummary;
        organization: {
          id: string;
          displayName: string;
          avatarUrl: string | null;
        };
        services: ReturnType<typeof presentMemberOffering>[];
      }
    >();
    for (const c of contexts) {
      if (this.serving.blocker(c)) continue;
      const entry = grouped.get(c.member.id) ?? {
        ...this.serving.publicIdentity(c),
        reviewSummary: summaries.get(c.member.id)!,
        organization: {
          id: providerId,
          displayName: c.member.provider.displayName,
          avatarUrl: c.member.provider.avatarUrl,
        },
        services: [],
      };
      entry.services.push(presentMemberOffering(c.offering));
      grouped.set(c.member.id, entry);
    }
    if (memberId && !grouped.has(memberId))
      throw new NotFoundException(
        'Không tìm thấy chuyên viên đang cung cấp dịch vụ.',
      );
    return {
      success: true,
      data: memberId ? grouped.get(memberId)! : [...grouped.values()],
    };
  }

  async isOrganizationOnline(providerId: string) {
    const now = new Date();
    const sessions =
      await this.prisma.providerMemberAvailabilitySession.findMany({
        where: {
          endedAt: null,
          lastHeartbeatAt: {
            gt: new Date(now.getTime() - this.serving.ttl * 1000),
          },
          member: { providerId, status: 'ACTIVE', canProvideServices: true },
        },
        select: { id: true, memberId: true, membershipVersion: true },
        orderBy: { lastHeartbeatAt: 'desc' },
        take: 50,
      });
    const contexts = await this.serving.loadMany(
      sessions.map((s) => s.memberId),
      {},
      now,
      new Date(now.getTime() + DAY),
    );
    const ready = new Set(
      contexts
        .filter(
          (ctx) =>
            !this.serving.blocker(ctx) &&
            this.eligibility.canReceiveNewOrder(
              ctx.member.provider.wallet,
              Math.ceil(ctx.offering.priceAmount / 10),
            ),
        )
        .map((ctx) => `${ctx.member.id}:${ctx.member.membershipVersion}`),
    );
    const live = await Promise.all(
      sessions
        .filter((s) => ready.has(`${s.memberId}:${s.membershipVersion}`))
        .map((s) =>
          this.locations
            .getMemberPosition(s.memberId, s.id)
            .then(Boolean)
            .catch(() => false),
        ),
    );
    return live.some(Boolean);
  }
}
