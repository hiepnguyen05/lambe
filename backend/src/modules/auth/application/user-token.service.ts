import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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
  constructor(private readonly jwtService: JwtService) {}

  generateAccessToken(userId: string, phone: string): string {
    return this.jwtService.sign({ sub: userId, phone, purpose: 'access' });
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
