import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const otpSecret = 'test-otp-secret-that-is-at-least-32-characters';
  const user = {
    id: 'user-id',
    phone: '0363668951',
    fullName: 'Nguyen Van A',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const hashOtp = (phone: string, code: string) =>
    createHmac('sha256', otpSecret).update(`${phone}:${code}`).digest('hex');

  const createService = () => {
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
        create: jest.fn().mockResolvedValue(user),
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
      getOrThrow: jest.fn().mockReturnValue(otpSecret),
    };
    const service = new AuthService(
      prisma as never,
      smsSender,
      jwtService as never,
      configService as never,
    );

    return { service, prisma, smsSender, jwtService };
  };

  beforeEach(() => jest.clearAllMocks());

  it('stores a hash instead of the plaintext OTP and sends the generated code', async () => {
    const { service, prisma, smsSender } = createService();

    await service.sendOtp({ phone: '+84363668951' });

    const createInput = prisma.otpCode.create.mock.calls[0][0];
    expect(createInput.data.phone).toBe('0363668951');
    expect(createInput.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createInput.data.expiresAt).toBeInstanceOf(Date);
    expect(createInput.data.type).toBe('REGISTER');
    expect(smsSender.sendOtp).toHaveBeenCalledWith(
      '0363668951',
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('limits OTP requests to three in ten minutes', async () => {
    const { service, prisma, smsSender } = createService();
    prisma.otpCode.count.mockResolvedValue(3);

    await expect(
      service.sendOtp({ phone: '0363668951' }),
    ).rejects.toMatchObject({
      status: 429,
    });
    expect(smsSender.sendOtp).not.toHaveBeenCalled();
  });

  it('removes the OTP record when SMS delivery fails', async () => {
    const { service, prisma, smsSender } = createService();
    smsSender.sendOtp.mockRejectedValue(new Error('SMS unavailable'));

    await expect(service.sendOtp({ phone: '0363668951' })).rejects.toThrow(
      'SMS unavailable',
    );
    expect(prisma.otpCode.delete).toHaveBeenCalledWith({
      where: { id: 'otp-id' },
    });
  });

  it('logs in an active user after OTP verification', async () => {
    const { service, prisma, jwtService } = createService();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashOtp(user.phone, '123456'),
      attemptCount: 0,
    });
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.verifyOtp({
      phone: user.phone,
      code: '123456',
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      phone: user.phone,
      purpose: 'access',
    });
    expect(result).toMatchObject({
      isNewUser: false,
      data: { accessToken: 'access-token' },
    });
  });

  it('increments the attempt counter for an incorrect OTP', async () => {
    const { service, prisma } = createService();
    prisma.otpCode.update.mockResolvedValue({ attemptCount: 1 });
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashOtp(user.phone, '123456'),
      attemptCount: 0,
    });

    await expect(
      service.verifyOtp({ phone: user.phone, code: '654321' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-id' },
      data: { attemptCount: { increment: 1 } },
    });
  });

  it('invalidates the OTP after the fifth incorrect attempt', async () => {
    const { service, prisma } = createService();
    prisma.otpCode.update.mockResolvedValue({ attemptCount: 5 });
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashOtp(user.phone, '123456'),
      attemptCount: 4,
    });

    await expect(
      service.verifyOtp({ phone: user.phone, code: '654321' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'otp-id', isUsed: false },
      data: { isUsed: true },
    });
  });

  it('rejects an OTP consumed by a parallel request', async () => {
    const { service, prisma } = createService();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashOtp(user.phone, '123456'),
      attemptCount: 0,
    });
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.verifyOtp({ phone: user.phone, code: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks inactive users from logging in', async () => {
    const { service, prisma } = createService();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashOtp(user.phone, '123456'),
      attemptCount: 0,
    });
    prisma.user.findUnique.mockResolvedValue({ ...user, status: 'INACTIVE' });

    await expect(
      service.verifyOtp({ phone: user.phone, code: '123456' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues a short-lived registration token for a new user', async () => {
    const { service, prisma, jwtService } = createService();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashOtp(user.phone, '123456'),
      attemptCount: 0,
    });
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.verifyOtp({
      phone: user.phone,
      code: '123456',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'registration',
        phone: user.phone,
        purpose: 'complete-registration',
      },
      { expiresIn: '5m' },
    );
    expect(result).toMatchObject({
      isNewUser: true,
      data: { registrationToken: 'registration-token' },
    });
  });

  it('creates a user only from a valid registration token', async () => {
    const { service, prisma, jwtService } = createService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'registration',
      phone: user.phone,
      purpose: 'complete-registration',
    });

    const result = await service.completeRegistration({
      registrationToken: 'registration-token',
      fullName: user.fullName,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { phone: user.phone, fullName: user.fullName },
    });
    expect(result).toMatchObject({ data: { accessToken: 'access-token' } });
  });

  it('rejects an invalid registration token', async () => {
    const { service, jwtService } = createService();
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

    await expect(
      service.completeRegistration({
        registrationToken: 'invalid',
        fullName: user.fullName,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
