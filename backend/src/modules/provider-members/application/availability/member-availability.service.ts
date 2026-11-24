import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import {
  MEMBER_LOCATION_STORE,
  type MemberLocationStore,
} from '../../../../infrastructure/location/member-location.store';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  MemberHeartbeatDto,
  MemberOnlineDto,
  MemberReceivingSettingsDto,
} from '../../dto/member-capabilities.dto';
import { ProviderMemberAccessService } from '../provider-member-access.service';
import {
  capabilityMember,
  closeMemberAvailability,
} from '../capabilities/member-capability-access';
import {
  memberEffectiveRadius,
  memberReceivingBlocker,
} from './member-receiving-eligibility';

@Injectable()
export class MemberAvailabilityService {
  private readonly ttl: number;
  private readonly minimumBalance: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProviderMemberAccessService,
    private readonly audit: AuditService,
    config: ConfigService,
    @Inject(MEMBER_LOCATION_STORE)
    private readonly locations: MemberLocationStore,
  ) {
    this.ttl = config.get<number>('cache.providerLocationTtlSeconds', 120);
    this.minimumBalance = config.get<number>(
      'provider.minReceivingBalanceAmount',
      50_000,
    );
  }

  private async own(
    userId: string,
    memberId: string,
    lock = false,
    tx = this.prisma as Parameters<typeof capabilityMember>[0],
  ) {
    // Owner may edit schedules, but must never send GPS or switch online for another worker.
    const candidate = await tx.providerMember.findFirst({
      where: { id: memberId, userId },
      select: { id: true },
    });
    if (!candidate)
      throw new NotFoundException('Không tìm thấy membership của bạn.');
    return capabilityMember(tx, userId, memberId, this.access, lock);
  }

  async settings(userId: string, memberId: string) {
    const member = await this.own(userId, memberId);
    return {
      success: true,
      data: {
        memberId,
        receivingRadiusKm: member.receivingRadiusKm,
        organizationRadiusKm: member.provider.serviceRadiusKm,
        effectiveRadiusKm: memberEffectiveRadius(member),
      },
    };
  }

  async configure(
    userId: string,
    memberId: string,
    dto: MemberReceivingSettingsDto,
    request: RequestMetadata,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const member = await this.own(userId, memberId, true, tx);
      if (
        member.status !== 'ACTIVE' ||
        !member.canProvideServices ||
        member.provider.status !== 'ACTIVE' ||
        member.provider.user.status !== 'ACTIVE'
      )
        throw new ForbiddenException('Chưa đủ điều kiện cấu hình nhận đơn.');
      if (
        !member.provider.serviceRadiusKm ||
        dto.receivingRadiusKm > member.provider.serviceRadiusKm
      )
        throw new BadRequestException(
          'Bán kính không được vượt cấu hình tổ chức.',
        );
      await closeMemberAvailability(tx, memberId, 'RECEIVING_RADIUS_CHANGED');
      await tx.providerMember.update({
        where: { id: memberId },
        data: { receivingRadiusKm: dto.receivingRadiusKm },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_RECEIVING_SETTINGS_CHANGED',
          resourceType: 'ProviderMember',
          resourceId: memberId,
          result: 'SUCCESS',
          metadata: { receivingRadiusKm: dto.receivingRadiusKm },
        },
        request,
        tx,
      );
    });
    return this.settings(userId, memberId);
  }

  async status(userId: string, memberId: string) {
    const member = await this.own(userId, memberId);
    const blockerCode = await memberReceivingBlocker(
      this.prisma,
      member,
      this.minimumBalance,
    );
    const session =
      await this.prisma.providerMemberAvailabilitySession.findFirst({
        where: {
          memberId,
          membershipVersion: member.membershipVersion,
          endedAt: null,
          lastHeartbeatAt: { gt: new Date(Date.now() - this.ttl * 1000) },
        },
        select: { id: true, startedAt: true, lastHeartbeatAt: true },
      });
    let online = false,
      locationAvailable = true;
    if (!blockerCode && session) {
      try {
        online = !!(await this.locations.getMemberPosition(
          memberId,
          session.id,
        ));
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
        locationAvailable = false;
      }
    }
    return {
      success: true,
      data: {
        online,
        session: online ? session : null,
        heartbeatTtlSeconds: this.ttl,
        recommendedHeartbeatSeconds: Math.max(
          5,
          Math.min(30, Math.floor(this.ttl / 3)),
        ),
        effectiveRadiusKm: memberEffectiveRadius(member),
        receivingEligibility: { eligible: !blockerCode, blockerCode },
        locationAvailable,
      },
    };
  }

  async online(
    userId: string,
    memberId: string,
    dto: MemberOnlineDto,
    request: RequestMetadata,
  ) {
    return this.publishSession(userId, memberId, dto, undefined, request);
  }

  async heartbeat(userId: string, memberId: string, dto: MemberHeartbeatDto) {
    return this.publishSession(userId, memberId, dto, dto.sessionId);
  }

  private async publishSession(
    userId: string,
    memberId: string,
    dto: MemberOnlineDto,
    sessionId?: string,
    request?: RequestMetadata,
  ) {
    const capturedAt = new Date(dto.capturedAt);
    if (
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(dto.capturedAt) ||
      !Number.isFinite(capturedAt.getTime()) ||
      capturedAt.getTime() < Date.now() - 60_000 ||
      capturedAt.getTime() > Date.now() + 15_000
    )
      throw new BadRequestException(
        'GPS quá cũ hoặc đồng hồ thiết bị không hợp lệ.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      const member = await this.own(userId, memberId, true, tx);
      const blocker = await memberReceivingBlocker(
        tx,
        member,
        this.minimumBalance,
      );
      const existing = await tx.providerMemberAvailabilitySession.findFirst({
        where: { memberId, endedAt: null },
      });
      if (blocker) {
        const closed = await closeMemberAvailability(tx, memberId, blocker);
        return { session: null, blocker, version: closed.availabilityVersion };
      }
      if (sessionId) {
        if (
          !existing ||
          existing.id !== sessionId ||
          existing.membershipVersion !== member.membershipVersion
        )
          throw new ConflictException({
            code: 'MEMBER_SESSION_CHANGED',
            message: 'Phiên đã đổi hoặc đã kết thúc. Hãy bật lại online.',
          });
        if (
          existing.lastHeartbeatAt.getTime() <=
          Date.now() - this.ttl * 1000
        ) {
          const closed = await closeMemberAvailability(
            tx,
            memberId,
            'HEARTBEAT_EXPIRED',
          );
          return {
            session: null,
            blocker: 'MEMBER_SESSION_EXPIRED',
            version: closed.availabilityVersion,
          };
        }
        if (capturedAt <= existing.lastCapturedAt)
          throw new ConflictException({
            code: 'STALE_GPS',
            message: 'Vị trí cũ đã được bỏ qua; hãy lấy GPS mới.',
          });
        const session = await tx.providerMemberAvailabilitySession.update({
          where: { id: sessionId },
          data: { lastHeartbeatAt: new Date(), lastCapturedAt: capturedAt },
        });
        return { session, blocker: null, version: session.version };
      }
      const updated = await closeMemberAvailability(
        tx,
        memberId,
        'RECONNECTED',
      );
      const session = await tx.providerMemberAvailabilitySession.create({
        data: {
          memberId,
          membershipVersion: member.membershipVersion,
          version: updated.availabilityVersion,
          lastCapturedAt: capturedAt,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_ONLINE',
          resourceType: 'ProviderMemberAvailabilitySession',
          resourceId: session.id,
          result: 'SUCCESS',
          metadata: { memberId },
        },
        request ?? {},
        tx,
      );
      return { session, blocker: null, version: session.version };
    });
    if (!result.session) {
      await this.locations
        .removeMemberPosition(memberId, result.version)
        .catch(() => undefined);
      throw new ConflictException({
        code: result.blocker,
        message:
          'Chưa đủ điều kiện online hoặc phiên đã hết hạn; hãy kiểm tra hồ sơ, lịch và ví tổ chức.',
      });
    }
    const session = result.session;
    try {
      // Redis is outside SQL locks. Session version/capturedAt fence stale writes after reconnect/offline.
      const saved = await this.locations.saveMemberPosition({
        memberId,
        sessionId: session.id,
        version: session.version,
        latitude: dto.latitude,
        longitude: dto.longitude,
        capturedAtMs: capturedAt.getTime(),
      });
      const current =
        await this.prisma.providerMemberAvailabilitySession.findFirst({
          where: { id: session.id, endedAt: null },
        });
      if (!saved || !current)
        throw new ConflictException({
          code: 'MEMBER_SESSION_CHANGED',
          message: 'Phiên hoạt động đã thay đổi. Hãy kiểm tra trạng thái.',
        });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // Only compensate our own session; a delayed old request must not close the new session.
      const closed = await this.prisma.$transaction(async (tx) => {
        const member = await this.own(userId, memberId, true, tx).catch(
          () => null,
        );
        if (!member) return null;
        const active = await tx.providerMemberAvailabilitySession.findFirst({
          where: { memberId, endedAt: null },
        });
        if (active?.id === session.id && active.lastCapturedAt <= capturedAt)
          return closeMemberAvailability(
            tx,
            memberId,
            'LOCATION_PUBLISH_FAILED',
          );
        return null;
      });
      if (closed)
        await this.locations
          .removeMemberPosition(memberId, closed.availabilityVersion)
          .catch(() => undefined);
      throw error;
    }
    return {
      success: true,
      data: {
        online: true,
        session: {
          id: session.id,
          startedAt: session.startedAt,
          lastHeartbeatAt: session.lastHeartbeatAt,
        },
        heartbeatTtlSeconds: this.ttl,
      },
    };
  }

  async offline(
    userId: string,
    memberId: string,
    sessionId: string,
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const member = await this.own(userId, memberId, true, tx);
      const session = await tx.providerMemberAvailabilitySession.findFirst({
        where: {
          id: sessionId,
          memberId,
          membershipVersion: member.membershipVersion,
        },
      });
      if (!session)
        throw new NotFoundException('Không tìm thấy phiên của thành viên.');
      const active = await tx.providerMemberAvailabilitySession.findFirst({
        where: { memberId, endedAt: null },
      });
      if (active && active.id !== sessionId)
        throw new ConflictException(
          'Không thể dùng phiên cũ để tắt phiên mới.',
        );
      const updated = await closeMemberAvailability(
        tx,
        memberId,
        'USER_OFFLINE',
      );
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_MEMBER_OFFLINE',
          resourceType: 'ProviderMemberAvailabilitySession',
          resourceId: sessionId,
          result: 'SUCCESS',
          metadata: { memberId },
        },
        request,
        tx,
      );
      return updated;
    });
    await this.locations
      .removeMemberPosition(memberId, result.availabilityVersion)
      .catch(() => undefined);
    return { success: true, data: { online: false } };
  }
}
