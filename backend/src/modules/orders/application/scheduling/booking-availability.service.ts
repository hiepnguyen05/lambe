import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  DAY,
  MINUTE,
  SCHEDULE_LEAD_MINUTES,
  suggestSlots,
} from '../../domain/booking-calendar.policy';
import type {
  BookingAvailabilityQueryDto,
  CalendarRangeDto,
  CreateTimeOffDto,
} from '../../dto/booking-calendar.dto';
import { OrderEligibilityService } from '../order-eligibility.service';
import { BookingCalendarService } from './booking-calendar.service';
import { MemberServingService } from '../../../provider-members/application/booking/member-serving.service';

@Injectable()
export class BookingAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: OrderEligibilityService,
    private readonly calendar: BookingCalendarService,
    private readonly members: MemberServingService,
  ) {}

  async findSlots(
    userId: string,
    providerId: string,
    dto: BookingAvailabilityQueryDto,
  ) {
    const now = new Date();
    const dayStart = new Date(`${dto.date}T00:00:00+07:00`);
    const until = new Date(
      Math.min(dayStart.getTime() + DAY, now.getTime() + 30 * DAY),
    );
    if (
      !Number.isFinite(dayStart.getTime()) ||
      until <= now ||
      dayStart.getTime() > now.getTime() + 30 * DAY
    )
      throw new BadRequestException('Chọn ngày từ hôm nay đến 30 ngày tới.');
    const loaded = await this.eligibility.load(userId, dto);
    const provider = loaded.providerService.provider;
    const member = dto.memberId
      ? await this.members.get(
          dto.memberId,
          loaded.providerService.id,
          dayStart,
          until,
          this.prisma,
          new Date(),
        )
      : null;
    if (member?.member.userId === userId)
      throw new BadRequestException('Không thể tự đặt lịch cho chính mình.');
    if (provider.id !== providerId)
      throw new NotFoundException('Dịch vụ không thuộc thợ đã chọn.');
    await this.eligibility.distance(
      {
        ...provider,
        serviceRadiusKm: member?.radiusKm ?? provider.serviceRadiusKm,
      },
      loaded.address,
      'SCHEDULED',
    );
    const canRequest = this.eligibility.canReceiveNewOrder(
      provider.wallet,
      loaded.commissionAmount,
    );
    const blocks =
      (
        await this.calendar.read(
          [providerId],
          dayStart,
          until,
          now,
          this.prisma,
          undefined,
          member ? new Map([[member.member.id, providerId]]) : undefined,
        )
      ).get(member?.member.id ?? providerId) ?? [];
    if (member)
      blocks.push(
        ...member.timeOffs.map((t) => ({ startAt: t.startAt, endAt: t.endAt })),
      );
    const slots = canRequest
      ? suggestSlots({
          startAt: new Date(
            Math.max(
              dayStart.getTime(),
              now.getTime() + SCHEDULE_LEAD_MINUTES * MINUTE,
            ),
          ),
          until,
          point: loaded.address,
          durationMinutes: loaded.durationMinutes,
          hours: member?.hours ?? provider.workingHours,
          blocks,
          limit: dto.limit ?? 20,
        })
      : [];
    return {
      success: true,
      data: {
        date: dto.date,
        timezone: 'Asia/Ho_Chi_Minh',
        providerServiceId: dto.providerServiceId,
        durationMinutes: loaded.durationMinutes,
        estimateSource: 'CONSERVATIVE_DISTANCE',
        requiresProviderConfirmation: true,
        slots: member
          ? slots.filter((s) => !this.members.blocker(member, s.endAt))
          : slots,
        memberId: member?.member.id ?? null,
        reason: canRequest ? null : 'PROVIDER_NOT_ACCEPTING_ORDERS',
      },
    };
  }

  async findCalendar(userId: string, dto: CalendarRangeDto) {
    const provider = await this.provider(userId);
    const { from, to } = this.range(dto);
    const data = await this.prisma.providerCalendarBlock.findMany({
      where: {
        providerId: provider.id,
        active: true,
        startAt: { lt: to },
        endAt: { gt: from },
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        orderId: true,
        startAt: true,
        endAt: true,
        holdExpiresAt: true,
        reason: true,
        order: {
          select: {
            status: true,
            bookingType: true,
            expectedStartAt: true,
            expectedEndAt: true,
            serviceName: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
      take: 500,
    });
    return {
      success: true,
      data,
      meta: { timezone: 'Asia/Ho_Chi_Minh', limit: 500 },
    };
  }

  async findMemberCalendar(
    userId: string,
    memberId: string,
    dto: CalendarRangeDto,
  ) {
    const member = await this.prisma.providerMember.findFirst({
      where: {
        id: memberId,
        status: { not: 'LEFT' },
        provider: { providerType: 'ORGANIZATION' },
        OR: [{ userId }, { provider: { userId } }],
      },
      select: { providerId: true, membershipVersion: true },
    });
    if (!member)
      throw new NotFoundException('Không tìm thấy lịch thành viên của bạn.');
    const { from, to } = this.range(dto);
    const [calendars, timeOffs] = await Promise.all([
      this.calendar.read(
        [member.providerId],
        from,
        to,
        new Date(),
        this.prisma,
        undefined,
        new Map([[memberId, member.providerId]]),
      ),
      this.prisma.providerMemberTimeOff.findMany({
        where: {
          memberId,
          membershipVersion: member.membershipVersion,
          cancelledAt: null,
          startAt: { lt: to },
          endAt: { gt: from },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);
    // Global legacy commitments are anonymous: workers must not learn another performer's order/address.
    const items = [
      ...(calendars.get(memberId) ?? []).map((b) => ({
        startAt: b.startAt,
        endAt: b.endAt,
        kind: 'BUSY',
        estimated: !!b.estimated,
      })),
      ...timeOffs.map((t) => ({
        startAt: t.startAt,
        endAt: t.endAt,
        kind: 'TIME_OFF',
        estimated: false,
      })),
    ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return {
      success: true,
      data: items.slice(0, 500),
      meta: {
        memberId,
        timezone: 'Asia/Ho_Chi_Minh',
        limit: 500,
        limited: items.length > 500,
      },
    };
  }

  async createTimeOff(userId: string, dto: CreateTimeOffDto) {
    const provider = await this.provider(userId);
    const { from, to } = this.range(dto);
    if (from < new Date() || to.getTime() > Date.now() + 31 * DAY)
      throw new BadRequestException(
        'Thời gian nghỉ phải nằm trong 31 ngày tới.',
      );
    if (to.getTime() - from.getTime() < 15 * MINUTE)
      throw new BadRequestException(
        'Mỗi khoảng nghỉ phải dài ít nhất 15 phút.',
      );
    const data = await this.prisma.$transaction(async (tx) => {
      await this.calendar.lockProvider(tx, provider.id);
      await this.calendar.releaseExpired(tx, provider.id, new Date());
      const count = await tx.providerCalendarBlock.count({
        where: {
          providerId: provider.id,
          orderId: null,
          active: true,
          endAt: { gt: new Date() },
        },
      });
      if (count >= 200)
        throw new BadRequestException(
          'Chỉ được tạo tối đa 200 khoảng nghỉ sắp tới.',
        );
      const blocks =
        (await this.calendar.read([provider.id], from, to, new Date(), tx)).get(
          provider.id,
        ) ?? [];
      if (blocks.some((block) => block.startAt < to && from < block.endAt))
        throw new BadRequestException(
          'Thời gian nghỉ trùng đơn đang giữ hoặc đã nhận.',
        );
      return tx.providerCalendarBlock.create({
        data: {
          providerId: provider.id,
          startAt: from,
          endAt: to,
          reason: dto.reason,
        },
        select: { id: true, startAt: true, endAt: true, reason: true },
      });
    });
    return { success: true, data };
  }

  async removeTimeOff(userId: string, id: string) {
    const provider = await this.provider(userId);
    await this.prisma.$transaction(async (tx) => {
      await this.calendar.lockProvider(tx, provider.id);
      const block = await tx.providerCalendarBlock.findFirst({
        where: { id, providerId: provider.id, orderId: null },
      });
      if (!block) throw new NotFoundException('Không tìm thấy thời gian nghỉ.');
      await tx.providerCalendarBlock.update({
        where: { id },
        data: { active: false },
      });
    });
    return { success: true, data: { id, active: false } };
  }

  private async provider(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('Không tìm thấy hồ sơ thợ.');
    return provider;
  }

  private range(dto: CalendarRangeDto) {
    const from = new Date(dto.from),
      to = new Date(dto.to);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 31 * DAY
    )
      throw new BadRequestException(
        'Khoảng thời gian phải hợp lệ và không quá 31 ngày.',
      );
    return { from, to };
  }
}
