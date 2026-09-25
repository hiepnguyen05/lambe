import { createHmac } from 'crypto';
import { OtpAuthenticationService } from '../application/otp-authentication.service';
import { UserProfileService } from '../application/user-profile.service';
import { UserRegistrationService } from '../application/user-registration.service';
import { UserTokenService } from '../application/user-token.service';

export const TEST_OTP_SECRET = 'test-otp-secret-that-is-at-least-32-characters';

export const TEST_USER = {
  id: 'user-id',
  phone: '0363668951',
  fullName: 'Nguyen Van A',
  status: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const hashTestOtp = (phone: string, code: string) =>
  createHmac('sha256', TEST_OTP_SECRET)
    .update(`${phone}:${code}`)
    .digest('hex');

export function createAuthTestContext() {
  const createOtp = jest.fn(
    (input: {
      data: {
        phone: string;
        codeHash: string;
        expiresAt: Date;
        type: 'REGISTER' | 'LOGIN';
      };
    }) => {
      void input;
      return Promise.resolve({ id: 'otp-id' });
    },
  );
  const prisma = {
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    otpCode: {
      count: jest.fn().mockResolvedValue(0),
      create: createOtp,
      delete: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      create: jest.fn().mockResolvedValue(TEST_USER),
      findUnique: jest.fn(),
    },
  };
  const smsSender = { sendOtp: jest.fn().mockResolvedValue(undefined) };
  const jwtService = {
    sign: jest.fn((payload: { purpose: string }) =>
      payload.purpose === 'access' ? 'access-token' : 'registration-token',
    ),
    verifyAsync: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(TEST_OTP_SECRET),
  };
  const tokenService = new UserTokenService(
    jwtService as never,
    configService as never,
  );

  return {
    otpAuthentication: new OtpAuthenticationService(
      prisma as never,
      smsSender,
      tokenService,
    ),
    registration: new UserRegistrationService(prisma as never, tokenService),
    userProfile: new UserProfileService(prisma as never),
    prisma,
    smsSender,
    jwtService,
  };
}
