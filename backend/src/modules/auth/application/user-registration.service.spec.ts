import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createAuthTestContext, TEST_USER } from '../testing/auth-test.factory';

describe('UserRegistrationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a user only from a valid registration token', async () => {
    const { registration, prisma, jwtService } = createAuthTestContext();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'registration',
      phone: TEST_USER.phone,
      purpose: 'complete-registration',
    });

    const result = await registration.completeRegistration({
      registrationToken: 'registration-token',
      fullName: TEST_USER.fullName,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { phone: TEST_USER.phone, fullName: TEST_USER.fullName },
    });
    expect(result).toMatchObject({ data: { accessToken: 'access-token' } });
  });

  it('rejects an invalid registration token', async () => {
    const { registration, jwtService } = createAuthTestContext();
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

    await expect(
      registration.completeRegistration({
        registrationToken: 'invalid',
        fullName: TEST_USER.fullName,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    {
      sub: 'user-id',
      phone: TEST_USER.phone,
      purpose: 'complete-registration',
    },
    { sub: 'registration', phone: TEST_USER.phone, purpose: 'access' },
    { sub: 'registration', phone: '', purpose: 'complete-registration' },
  ])(
    'rejects a registration token with an invalid payload',
    async (payload) => {
      const { registration, prisma, jwtService } = createAuthTestContext();
      jwtService.verifyAsync.mockResolvedValue(payload);

      await expect(
        registration.completeRegistration({
          registrationToken: 'wrong-purpose-token',
          fullName: TEST_USER.fullName,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    },
  );

  it('maps a duplicate phone race to a conflict response', async () => {
    const { registration, prisma, jwtService } = createAuthTestContext();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'registration',
      phone: TEST_USER.phone,
      purpose: 'complete-registration',
    });
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate phone', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      registration.completeRegistration({
        registrationToken: 'registration-token',
        fullName: TEST_USER.fullName,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not hide unexpected database errors during registration', async () => {
    const { registration, prisma, jwtService } = createAuthTestContext();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'registration',
      phone: TEST_USER.phone,
      purpose: 'complete-registration',
    });
    prisma.user.create.mockRejectedValue(new Error('database unavailable'));

    await expect(
      registration.completeRegistration({
        registrationToken: 'registration-token',
        fullName: TEST_USER.fullName,
      }),
    ).rejects.toThrow('database unavailable');
  });
});
