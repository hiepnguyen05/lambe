import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { assertWorkingHoursValid } from '../../../providers/domain/provider-setup.policy';
import type {
  MemberChangeReasonDto,
  MemberTimeOffDto,
  MemberTimeOffQueryDto,
  MemberWorkingHoursDto,
} from '../../dto/member-capabilities.dto';
import { ProviderMemberAccessService } from '../provider-member-access.service';
import { assertNoMemberExitObligations } from '../member-exit-obligations';
import {
  assertCapabilityEditable,
  capabilityMember,
  closeMemberAvailability,
} from './member-capability-access';

const DAY = 86_400_000;
export function memberTimeRange(start: string, end: string) {
  if (![start, end].every((value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)))
    throw new BadRequestException('Thời gian phải có múi giờ.');
  const startAt = new Date(start),
    endAt = new Date(end);
  if (
    !Number.isFinite(startAt.getTime()) ||
    !Number.isFinite(endAt.getTime()) ||
    endAt <= startAt
  )
    throw new BadRequestException('Khoảng thời gian không hợp lệ.');
  return { startAt, endAt };
}

@Injectable()
export class MemberScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async hours(userId: string, memberId: string) {
    const member = await capabilityMember(
      this.prisma,
      userId,
      memberId,
      this.access,
    );
    const data = await this.prisma.providerMemberWorkingHour.findMany({
      where: { memberId, membershipVersion: member.membershipVersion },
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
    return { success: true, data, meta: { timeZone: 'Asia/Ho_Chi_Minh' } };
  }

  async replaceHours(
    userId: string,
    memberId: string,
    dto: MemberWorkingHoursDto,
    request: RequestMetadata,
  ) {
    assertWorkingHoursValid(dto.workingHours);
    await this.prisma.$transaction(async (tx) => {
      const member = await capabilityMember(
        tx,
        userId,
        memberId,
        this.access,
        true,
      );
      assertCapabilityEditable(member, userId, dto.reason);
      await assertNoMemberExitObligations(tx, member.providerId, member.id);
      await tx.providerMemberWorkingHour.deleteMany({
        where: { memberId, membershipVersion: member.membershipVersion },
      });
      await tx.providerMemberWorkingHour.createMany({
        data: dto.workingHours.map((h) => ({
          memberId,
          membershipVersion: member.membershipVersion,
          ...h,
        })),
      });
      await closeMemberAvailability(tx, memberId, 'WORKING_HOURS_CHANGED');
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_HOURS_CHANGED',
          resourceType: 'ProviderMember',
          resourceId: memberId,
          result: 'SUCCESS',
          metadata: {
            reason: dto.reason ?? null,
            workingHours: dto.workingHours.map((h) => ({ ...h })),
          },
        },
        request,
        tx,
      );
    });
    return this.hours(userId, memberId);
  }

  async timeOffs(
    userId: string,
    memberId: string,
    query: MemberTimeOffQueryDto,
  ) {
    const member = await capabilityMember(
      this.prisma,
      userId,
      memberId,
      this.access,
    );
    const from = query.from ?? new Date().toISOString();
    const to =
      query.to ?? new Date(new Date(from).getTime() + 90 * DAY).toISOString();
    const { startAt, endAt } = memberTimeRange(from, to);
    if (endAt.getTime() - startAt.getTime() > 366 * DAY)
      throw new BadRequestException('Khoảng truy vấn tối đa 366 ngày.');
    const data = await this.prisma.providerMemberTimeOff.findMany({
      where: {
        memberId,
        membershipVersion: member.membershipVersion,
        cancelledAt: null,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true, startAt: true, endAt: true, reason: true },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { success: true, data };
  }

  async addTimeOff(
    userId: string,
    memberId: string,
    dto: MemberTimeOffDto,
    request: RequestMetadata,
  ) {
    const range = memberTimeRange(dto.startAt, dto.endAt);
    if (
      range.startAt.getTime() < Date.now() ||
      range.endAt.getTime() - range.startAt.getTime() > 90 * DAY ||
      range.startAt.getTime() > Date.now() + 366 * DAY
    )
      throw new BadRequestException(
        'Nghỉ phép phải ở tương lai, tối đa 90 ngày/lần và bắt đầu trong 366 ngày tới.',
      );
    const data = await this.prisma.$transaction(async (tx) => {
      const member = await capabilityMember(
        tx,
        userId,
        memberId,
        this.access,
        true,
      );
      assertCapabilityEditable(member, userId, dto.reason);
      await assertNoMemberExitObligations(tx, member.providerId, member.id);
      if (
        (await tx.providerMemberTimeOff.count({
          where: {
            memberId,
            membershipVersion: member.membershipVersion,
            cancelledAt: null,
            endAt: { gt: new Date() },
          },
        })) >= 100
      )
        throw new ConflictException('Tối đa 100 khoảng nghỉ chưa kết thúc.');
      if (
        await tx.providerMemberTimeOff.findFirst({
          where: {
            memberId,
            membershipVersion: member.membershipVersion,
            cancelledAt: null,
            startAt: { lt: range.endAt },
            endAt: { gt: range.startAt },
          },
          select: { id: true },
        })
      )
        throw new ConflictException('Khoảng nghỉ trùng với lịch nghỉ đã có.');
      const result = await tx.providerMemberTimeOff.create({
        data: {
          memberId,
          membershipVersion: member.membershipVersion,
          ...range,
          reason: dto.reason,
        },
      });
      await closeMemberAvailability(tx, memberId, 'TIME_OFF_CHANGED');
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_TIME_OFF_ADDED',
          resourceType: 'ProviderMemberTimeOff',
          resourceId: result.id,
          result: 'SUCCESS',
          metadata: { memberId, reason: dto.reason ?? null },
        },
        request,
        tx,
      );
      return result;
    });
    return { success: true, data };
  }

  async cancelTimeOff(
    userId: string,
    memberId: string,
    id: string,
    dto: MemberChangeReasonDto,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const member = await capabilityMember(
        tx,
        userId,
        memberId,
        this.access,
        true,
      );
      assertCapabilityEditable(member, userId, dto.reason);
      const item = await tx.providerMemberTimeOff.findFirst({
        where: { id, memberId, membershipVersion: member.membershipVersion },
      });
      if (!item) throw new NotFoundException('Không tìm thấy lịch nghỉ.');
      if (item.cancelledAt) return;
      await tx.providerMemberTimeOff.update({
        where: { id },
        data: { cancelledAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_TIME_OFF_CANCELLED',
          resourceType: 'ProviderMemberTimeOff',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { memberId, reason: dto.reason ?? null },
        },
        request,
        tx,
      );
    });
    return { success: true, data: { id, cancelled: true } };
  }
}
