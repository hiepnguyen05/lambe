import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { InternalRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
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

  createRefreshToken(): string {
    return randomBytes(64).toString('base64url');
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
