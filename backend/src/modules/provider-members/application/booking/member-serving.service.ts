import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEMBER_LOCATION_STORE,
  type MemberLocationStore,
} from '../../../../infrastructure/location/member-location.store';
import { capabilityMemberInclude } from '../capabilities/member-capability-access';
import {
  memberOfferingInclude,
  memberServiceBlocker,
} from '../capabilities/member-service-eligibility';
import { memberVerificationInclude } from '../verification/member-verification.persistence';
import { memberEffectiveRadius } from '../availability/member-receiving-eligibility';

const servingMemberInclude = {
  ...capabilityMemberInclude,
  user: {
    select: {
      status: true,
      phoneVerifiedAt: true,
      fullName: true,
      avatarUrl: true,
    },
  },
  verifications: {
    orderBy: { membershipVersion: 'desc' as const },
    take: 1,
    include: memberVerificationInclude,
  },
} satisfies Prisma.ProviderMemberInclude;

@Injectable()
export class MemberServingService {
  readonly ttl: number;
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Inject(MEMBER_LOCATION_STORE) readonly locations: MemberLocationStore,
  ) {
    this.ttl = config.get<number>('cache.providerLocationTtlSeconds', 120);
  }

  async loadMany(
    memberIds: string[],
    selector: { providerServiceId?: string; serviceId?: string },
    from: Date,
    until: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (!memberIds.length) return [];
    const members = await tx.providerMember.findMany({
      where: {
        id: { in: memberIds.slice(0, 300) },
        provider: { providerType: 'ORGANIZATION' },
      },
      include: servingMemberInclude,
    });
    if (!members.length) return [];
    const versions = members.map((m) => ({
      memberId: m.id,
      membershipVersion: m.membershipVersion,
    }));
    const [assignments, hours, timeOffs] = await Promise.all([
      tx.providerMemberService.findMany({
        where: {
          OR: versions,
          enabled: true,
          ...(selector.providerServiceId
            ? { providerServiceId: selector.providerServiceId }
            : {}),
          ...(selector.serviceId
            ? { providerService: { serviceId: selector.serviceId } }
            : {}),
        },
        include: { providerService: { include: memberOfferingInclude } },
      }),
      tx.providerMemberWorkingHour.findMany({
        where: { OR: versions },
        select: {
          memberId: true,
          dayOfWeek: true,
          startMinute: true,
          endMinute: true,
        },
      }),
      tx.providerMemberTimeOff.findMany({
        where: {
          OR: versions,
          cancelledAt: null,
          startAt: { lt: until },
          endAt: { gt: from },
        },
        select: { memberId: true, startAt: true, endAt: true },
      }),
    ]);
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const hourMap = new Map<string, typeof hours>();
    const offMap = new Map<string, typeof timeOffs>();
    for (const h of hours) {
      const list = hourMap.get(h.memberId) ?? [];
      list.push(h);
      hourMap.set(h.memberId, list);
    }
    for (const off of timeOffs) {
      const list = offMap.get(off.memberId) ?? [];
      list.push(off);
      offMap.set(off.memberId, list);
    }
    return assignments.flatMap((a) => {
      const member = memberMap.get(a.memberId)!;
      const profile =
        member.verifications[0]?.membershipVersion === member.membershipVersion
          ? member.verifications[0]
          : null;
      return [
        {
          member,
          profile,
          offering: a.providerService,
          hours: hourMap.get(a.memberId) ?? [],
          timeOffs: offMap.get(a.memberId) ?? [],
          radiusKm: memberEffectiveRadius(member),
        },
      ];
    });
  }

  blocker(context: MemberServingContext, validUntil = new Date()) {
    const { member, profile, offering } = context;
    if (
      member.status !== 'ACTIVE' ||
      !member.canProvideServices ||
      member.user.status !== 'ACTIVE' ||
      !member.user.phoneVerifiedAt
    )
      return 'MEMBER_NOT_ACTIVE';
    if (
      member.provider.status !== 'ACTIVE' ||
      member.provider.user.status !== 'ACTIVE' ||
      !member.provider.acceptingMemberOrders
    )
      return 'ORGANIZATION_NOT_ACCEPTING_ORDERS';
    if (!member.provider.setupCompletedAt || !context.radiusKm)
      return 'ORGANIZATION_SETUP_REQUIRED';
    if (offering.providerId !== member.providerId)
      return 'MEMBER_SERVICE_MISMATCH';
    return memberServiceBlocker(profile, offering, validUntil);
  }

  async get(
    memberId: string | undefined,
    providerServiceId: string,
    from: Date,
    until: Date,
    tx: Prisma.TransactionClient = this.prisma,
    validUntil = until,
  ) {
    if (!memberId)
      throw new BadRequestException({
        code: 'MEMBER_REQUIRED',
        message: 'Hãy chọn nhân viên thực hiện của tổ chức.',
      });
    const context = (
      await this.loadMany([memberId], { providerServiceId }, from, until, tx)
    )[0];
    if (!context)
      throw new ConflictException({
        code: 'MEMBER_SERVICE_UNAVAILABLE',
        message:
          'Thành viên không được cấp dịch vụ này ở lần gia nhập hiện tại.',
      });
    const code = this.blocker(context, validUntil);
    if (code)
      throw new ConflictException({
        code,
        message: 'Nhân viên hoặc chuyên môn chưa đủ điều kiện nhận lịch này.',
      });
    return context;
  }

  async capturePosition(memberId: string): Promise<MemberOrigin> {
    const session =
      await this.prisma.providerMemberAvailabilitySession.findFirst({
        where: {
          memberId,
          endedAt: null,
          lastHeartbeatAt: { gt: new Date(Date.now() - this.ttl * 1000) },
        },
        select: {
          id: true,
          memberId: true,
          membershipVersion: true,
          version: true,
        },
      });
    const point = session
      ? await this.locations.getMemberPosition(memberId, session.id)
      : null;
    if (!session || !point)
      throw new ConflictException({
        code: 'MEMBER_OFFLINE',
        message: 'Nhân viên đang offline hoặc vị trí đã hết hạn.',
      });
    return {
      ...point,
      memberId,
      sessionId: session.id,
      membershipVersion: session.membershipVersion,
      observedAt: Date.now(),
    };
  }

  async assertOrigin(
    tx: Prisma.TransactionClient,
    context: MemberServingContext,
    origin: MemberOrigin,
  ) {
    if (
      origin.memberId !== context.member.id ||
      origin.membershipVersion !== context.member.membershipVersion ||
      origin.observedAt < Date.now() - Math.min(30, this.ttl) * 1000
    )
      throw new ConflictException(
        'Phiên/vị trí nhân viên đã thay đổi. Hãy tìm kiếm lại.',
      );
    const active = await tx.providerMemberAvailabilitySession.findFirst({
      where: {
        id: origin.sessionId,
        memberId: origin.memberId,
        membershipVersion: origin.membershipVersion,
        endedAt: null,
        lastHeartbeatAt: { gt: new Date(Date.now() - this.ttl * 1000) },
      },
      select: { id: true },
    });
    if (!active)
      throw new ConflictException({
        code: 'MEMBER_OFFLINE',
        message: 'Nhân viên đã kết thúc phiên hoạt động.',
      });
  }

  publicIdentity(context: MemberServingContext) {
    return {
      id: context.member.id,
      displayName:
        context.member.displayName ??
        context.member.user.fullName ??
        'Chuyên viên',
      avatarUrl: context.member.avatarUrl ?? context.member.user.avatarUrl,
      experienceYears: context.profile?.experienceYears ?? 0,
    };
  }
}

export interface MemberOrigin {
  latitude: number;
  longitude: number;
  memberId: string;
  sessionId: string;
  membershipVersion: number;
  observedAt: number;
}
export type MemberServingContext = Awaited<
  ReturnType<MemberServingService['loadMany']>
>[number];
