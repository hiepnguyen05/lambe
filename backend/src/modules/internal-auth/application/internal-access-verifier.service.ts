import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { InternalRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

interface InternalAccessTokenPayload {
  sub: string;
  username: string;
  roles: InternalRole[];
  sessionId: string;
  tokenVersion: number;
  purpose: 'internal_access';
}

const INVALID_INTERNAL_SESSION =
  'Phiên đăng nhập nội bộ không hợp lệ hoặc đã hết hạn.';

@Injectable()
export class InternalAccessVerifierService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async verify(token: string): Promise<AuthenticatedInternalAccount> {
    try {
      const payload =
        await this.jwtService.verifyAsync<InternalAccessTokenPayload>(token);

      if (
        payload.purpose !== 'internal_access' ||
        !payload.sub ||
        !payload.sessionId
      ) {
        throw new Error('Invalid internal token payload');
      }

      const session = await this.prisma.internalSession.findUnique({
        where: { id: payload.sessionId },
        include: {
          account: {
            include: {
              roles: { where: { revokedAt: null } },
            },
          },
        },
      });

      if (
        !session ||
        session.accountId !== payload.sub ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.account.status !== 'ACTIVE' ||
        session.account.tokenVersion !== payload.tokenVersion
      ) {
        throw new Error('Inactive internal session');
      }

      const roles = session.account.roles.map((assignment) => assignment.role);
      if (roles.length === 0) {
        throw new Error('Internal account has no active role');
      }

      return {
        accountId: session.account.id,
        username: session.account.username,
        roles,
        sessionId: session.id,
      };
    } catch {
      throw new UnauthorizedException(INVALID_INTERNAL_SESSION);
    }
  }
}
