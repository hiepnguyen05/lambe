import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

interface RegistrationTokenPayload {
  sub: 'registration';
  phone: string;
  firebaseUid: string;
  purpose: 'complete-registration';
}

export interface VerifiedRegistrationIdentity {
  phone: string;
  firebaseUid: string;
}

@Injectable()
export class UserTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(
    userId: string,
    phone: string,
    sessionId: string,
  ): string {
    const expiresIn = this.configService.get<string>(
      'security.jwtExpiresIn',
      '15m',
    ) as JwtSignOptions['expiresIn'];
    return this.jwtService.sign(
      { sub: userId, phone, sessionId, purpose: 'access' },
      { expiresIn },
    );
  }

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

  getRefreshExpiry(): Date {
    const days = this.configService.get<number>(
      'security.refreshTokenExpiresDays',
      30,
    );
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private signRefreshToken(value: string): string {
    return createHmac(
      'sha256',
      this.configService.getOrThrow<string>('security.jwtSecret'),
    )
      .update(`user-refresh:${value}`)
      .digest('hex');
  }

  generateRegistrationToken(phone: string, firebaseUid: string): string {
    return this.jwtService.sign(
      {
        sub: 'registration',
        phone,
        firebaseUid,
        purpose: 'complete-registration',
      },
      { expiresIn: '5m' },
    );
  }

  async verifyRegistrationToken(
    token: string,
  ): Promise<VerifiedRegistrationIdentity> {
    try {
      const payload =
        await this.jwtService.verifyAsync<RegistrationTokenPayload>(token);

      if (
        payload.sub !== 'registration' ||
        payload.purpose !== 'complete-registration' ||
        !payload.phone ||
        !payload.firebaseUid
      ) {
        throw new Error('Invalid registration token payload');
      }

      return { phone: payload.phone, firebaseUid: payload.firebaseUid };
    } catch {
      throw new BadRequestException(
        'Registration token không hợp lệ hoặc đã hết hạn.',
      );
    }
  }
}
