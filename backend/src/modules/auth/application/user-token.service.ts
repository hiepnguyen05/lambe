import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, timingSafeEqual } from 'crypto';

interface RegistrationTokenPayload {
  sub: 'registration';
  phone: string;
  purpose: 'complete-registration';
}

@Injectable()
export class UserTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  hashOtp(phone: string, code: string): string {
    const secret = this.configService.getOrThrow<string>(
      'security.otpHashSecret',
    );

    return createHmac('sha256', secret)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  matchesOtp(expectedHash: string, actualHash: string): boolean {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  generateAccessToken(userId: string, phone: string): string {
    return this.jwtService.sign({ sub: userId, phone, purpose: 'access' });
  }

  generateRegistrationToken(phone: string): string {
    return this.jwtService.sign(
      { sub: 'registration', phone, purpose: 'complete-registration' },
      { expiresIn: '5m' },
    );
  }

  async verifyRegistrationToken(token: string): Promise<string> {
    try {
      const payload =
        await this.jwtService.verifyAsync<RegistrationTokenPayload>(token);

      if (
        payload.sub !== 'registration' ||
        payload.purpose !== 'complete-registration' ||
        !payload.phone
      ) {
        throw new Error('Invalid registration token payload');
      }

      return payload.phone;
    } catch {
      throw new BadRequestException(
        'Registration token không hợp lệ hoặc đã hết hạn.',
      );
    }
  }
}
