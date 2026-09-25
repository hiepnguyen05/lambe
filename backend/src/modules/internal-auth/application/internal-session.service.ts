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

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.account.status !== 'ACTIVE' ||
      session.account.roles.length === 0
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const nextRefreshToken = this.tokenService.createRefreshToken();
    const updateResult = await this.prisma.internalSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash,
        revokedAt: null,
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

  async logout(refreshToken: string | undefined, request: RequestMetadata) {
    if (refreshToken) {
      const session = await this.prisma.internalSession.findUnique({
        where: {
          refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
        },
      });

      if (session && !session.revokedAt) {
        await this.prisma.$transaction(async (transaction) => {
          await transaction.internalSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
          });
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
}
