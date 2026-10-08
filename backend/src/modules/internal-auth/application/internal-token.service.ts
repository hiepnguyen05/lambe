import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { InternalRole } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { InternalAccountWithAuth } from './internal-account.model';

interface InternalTokenPayload {
  sub: string;
  username: string;
  roles: InternalRole[];
  sessionId: string;
  tokenVersion: number;
  purpose: 'internal_access';
}

@Injectable()
export class InternalTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  createRefreshToken(sessionId: string): string {
    const value = `v1.${sessionId}.${randomBytes(64).toString('base64url')}`;
    return `${value}.${this.signRefreshToken(value)}`;
  }

  getRefreshSessionId(token: string): string | null {
    const parts = token.split('.');
    if (
      parts.length !== 4 ||
      parts[0] !== 'v1' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        parts[1],
      ) ||
      !/^[A-Za-z0-9_-]{86}$/.test(parts[2]) ||
      !/^[0-9a-f]{64}$/.test(parts[3])
    ) {
      return null;
    }

    const value = parts.slice(0, 3).join('.');
    const expected = Buffer.from(this.signRefreshToken(value), 'hex');
    const actual = Buffer.from(parts[3], 'hex');
    return timingSafeEqual(expected, actual) ? parts[1] : null;
  }

  private signRefreshToken(value: string): string {
    return createHmac(
      'sha256',
      this.configService.getOrThrow<string>('internalAuth.jwtSecret'),
    )
      .update(value)
      .digest('hex');
  }

  getRefreshExpiry(): Date {
    const days = this.configService.get<number>(
      'internalAuth.refreshTokenExpiresDays',
      7,
    );
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  generateAccessToken(
    account: InternalAccountWithAuth,
    sessionId: string,
  ): string {
    const payload: InternalTokenPayload = {
      sub: account.id,
      username: account.username,
      roles: account.roles.map((assignment) => assignment.role),
      sessionId,
      tokenVersion: account.tokenVersion,
      purpose: 'internal_access',
    };
    const expiresIn = this.configService.get<string>(
      'internalAuth.accessTokenExpiresIn',
      '15m',
    ) as JwtSignOptions['expiresIn'];

    return this.jwtService.sign(payload, { expiresIn });
  }
}
