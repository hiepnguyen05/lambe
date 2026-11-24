import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { toPublicUser } from './user.model';
import { UserTokenService } from './user-token.service';

const INVALID_SESSION_MESSAGE = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';

@Injectable()
export class UserSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokens: UserTokenService,
  ) {}

  async create(userId: string, phone: string, request: RequestMetadata) {
    const sessionId = randomUUID();
    const refreshToken = this.tokens.createRefreshToken(sessionId);
    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: this.tokens.getRefreshExpiry(),
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      },
    });
    return {
      accessToken: this.tokens.generateAccessToken(userId, phone, sessionId),
      refreshToken,
    };
  }

  async refresh(refreshToken: string, request: RequestMetadata) {
    const now = new Date();
    const refreshTokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash },
      include: {
        user: { include: { roles: true, customerProfile: true } },
      },
    });

    if (!session) {
      await this.revokeReplayedSession(refreshToken, refreshTokenHash, request);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
    if (
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const nextRefreshToken = this.tokens.createRefreshToken(session.id);
    const updated = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: this.tokens.hashRefreshToken(nextRefreshToken),
        lastUsedAt: now,
        rotationCount: { increment: 1 },
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      },
    });
    if (updated.count !== 1) {
      await this.revokeReplayedSession(refreshToken, refreshTokenHash, request);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    return {
      success: true,
      data: {
        accessToken: this.tokens.generateAccessToken(
          session.user.id,
          session.user.phone,
          session.id,
        ),
        refreshToken: nextRefreshToken,
        user: toPublicUser(session.user),
      },
    };
  }

  async logout(refreshToken: string, request: RequestMetadata) {
    const refreshTokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session =
      (await this.prisma.userSession.findUnique({
        where: { refreshTokenHash },
      })) ?? (await this.findSignedSession(refreshToken));

    if (session && !session.revokedAt) {
      await this.prisma.$transaction(async (transaction) => {
        const revoked = await transaction.userSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
        });
        if (revoked.count === 0) return;
        await transaction.userPushDevice.updateMany({
          where: { sessionId: session.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record(
          {
            actorUserId: session.userId,
            action: 'USER_LOGOUT',
            resourceType: 'UserSession',
            resourceId: session.id,
            result: 'SUCCESS',
          },
          request,
          transaction,
        );
      });
    }
    return { success: true, message: 'Đăng xuất thành công.' };
  }

  private async revokeReplayedSession(
    refreshToken: string,
    refreshTokenHash: string,
    request: RequestMetadata,
  ): Promise<void> {
    const sessionId = this.tokens.getRefreshSessionId(refreshToken);
    if (!sessionId) return;

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.userSession.updateMany({
        where: {
          id: sessionId,
          refreshTokenHash: { not: refreshTokenHash },
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokeReason: 'REFRESH_REPLAY' },
      });
      if (revoked.count === 0) return;
      await transaction.userPushDevice.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const session = await transaction.userSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      await this.audit.record(
        {
          actorUserId: session?.userId,
          action: 'USER_REFRESH_REPLAY',
          resourceType: 'UserSession',
          resourceId: sessionId,
          result: 'REVOKED',
        },
        request,
        transaction,
      );
    });
  }

  private async findSignedSession(refreshToken: string) {
    const sessionId = this.tokens.getRefreshSessionId(refreshToken);
    return sessionId
      ? this.prisma.userSession.findUnique({ where: { id: sessionId } })
      : null;
  }
}
