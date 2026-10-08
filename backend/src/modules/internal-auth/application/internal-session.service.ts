import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  activeInternalAccountInclude,
  toPublicInternalAccount,
} from './internal-account.model';
import { InternalTokenService } from './internal-token.service';

const INVALID_SESSION_MESSAGE =
  'Phiên đăng nhập nội bộ không hợp lệ hoặc đã hết hạn.';

@Injectable()
export class InternalSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tokenService: InternalTokenService,
  ) {}

  async refresh(refreshToken: string, request: RequestMetadata) {
    const now = new Date();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.prisma.internalSession.findUnique({
      where: { refreshTokenHash },
      include: {
        account: { include: activeInternalAccountInclude },
      },
    });

    if (!session) {
      await this.revokeReplayedSession(refreshToken, refreshTokenHash, request);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (
      session.revokedAt ||
      session.expiresAt <= now ||
      session.account.status !== 'ACTIVE' ||
      session.account.roles.length === 0
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const nextRefreshToken = this.tokenService.createRefreshToken(session.id);
    const updateResult = await this.prisma.internalSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: this.tokenService.hashRefreshToken(nextRefreshToken),
        lastUsedAt: now,
        rotationCount: { increment: 1 },
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      },
    });

    if (updateResult.count === 0) {
      await this.revokeReplayedSession(refreshToken, refreshTokenHash, request);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    return {
      refreshToken: nextRefreshToken,
      response: {
        success: true,
        data: {
          accessToken: this.tokenService.generateAccessToken(
            session.account,
            session.id,
          ),
          account: toPublicInternalAccount(session.account),
        },
      },
    };
  }

  private async revokeReplayedSession(
    refreshToken: string,
    refreshTokenHash: string,
    request: RequestMetadata,
  ): Promise<void> {
    const sessionId = this.tokenService.getRefreshSessionId(refreshToken);
    if (!sessionId) return;

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.internalSession.updateMany({
        where: {
          id: sessionId,
          refreshTokenHash: { not: refreshTokenHash },
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokeReason: 'REFRESH_REPLAY' },
      });
      if (result.count === 0) return;

      const session = await transaction.internalSession.findUnique({
        where: { id: sessionId },
        select: { accountId: true },
      });
      await this.auditService.record(
        {
          actorInternalAccountId: session?.accountId,
          action: 'INTERNAL_REFRESH_REPLAY',
          resourceType: 'InternalSession',
          resourceId: sessionId,
          result: 'REVOKED',
        },
        request,
        transaction,
      );
    });
  }

  async logout(refreshToken: string | undefined, request: RequestMetadata) {
    if (refreshToken) {
      const session =
        (await this.prisma.internalSession.findUnique({
          where: {
            refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
          },
        })) ?? (await this.findSignedRefreshSession(refreshToken));

      if (session && !session.revokedAt) {
        await this.prisma.$transaction(async (transaction) => {
          const revoked = await transaction.internalSession.updateMany({
            where: { id: session.id, revokedAt: null },
            data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
          });
          if (revoked.count === 0) return;
          await this.auditService.record(
            {
              actorInternalAccountId: session.accountId,
              action: 'INTERNAL_LOGOUT',
              resourceType: 'InternalSession',
              resourceId: session.id,
              result: 'SUCCESS',
            },
            request,
            transaction,
          );
        });
      }
    }

    return { success: true, message: 'Đăng xuất thành công.' };
  }

  private async findSignedRefreshSession(refreshToken: string) {
    const sessionId = this.tokenService.getRefreshSessionId(refreshToken);
    return sessionId
      ? this.prisma.internalSession.findUnique({ where: { id: sessionId } })
      : null;
  }
}
