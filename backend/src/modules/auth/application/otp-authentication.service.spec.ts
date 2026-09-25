import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import {
  createAuthTestContext,
  hashTestOtp,
  TEST_USER,
} from '../testing/auth-test.factory';

describe('OtpAuthenticationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores a hash instead of the plaintext OTP and sends the generated code', async () => {
    const { otpAuthentication, prisma, smsSender } = createAuthTestContext();

    await otpAuthentication.sendOtp({ phone: '+84363668951' });

    const createInput = prisma.otpCode.create.mock.calls[0][0];
    expect(createInput.data.phone).toBe(TEST_USER.phone);
    expect(createInput.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createInput.data.expiresAt).toBeInstanceOf(Date);
    expect(createInput.data.type).toBe('REGISTER');
    expect(smsSender.sendOtp).toHaveBeenCalledWith(
      TEST_USER.phone,
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('creates a LOGIN OTP and invalidates older codes for an existing user', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue({ id: TEST_USER.id });

    await otpAuthentication.sendOtp({ phone: TEST_USER.phone });

    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: {
        phone: TEST_USER.phone,
        isUsed: false,
        expiresAt: { gte: expect.any(Date) as Date },
      },
      data: { isUsed: true },
    });
    expect(prisma.otpCode.create.mock.calls[0][0].data.type).toBe('LOGIN');
  });

  it('limits OTP requests to three in ten minutes', async () => {
    const { otpAuthentication, prisma, smsSender } = createAuthTestContext();
    prisma.otpCode.count.mockResolvedValue(3);

    await expect(
      otpAuthentication.sendOtp({ phone: TEST_USER.phone }),
    ).rejects.toMatchObject({ status: 429 });
    expect(smsSender.sendOtp).not.toHaveBeenCalled();
  });

  it('removes the OTP record when SMS delivery fails', async () => {
    const { otpAuthentication, prisma, smsSender } = createAuthTestContext();
    smsSender.sendOtp.mockRejectedValue(new Error('SMS unavailable'));

    await expect(
      otpAuthentication.sendOtp({ phone: TEST_USER.phone }),
    ).rejects.toThrow('SMS unavailable');
    expect(prisma.otpCode.delete).toHaveBeenCalledWith({
      where: { id: 'otp-id' },
    });
  });

  it('logs in an active user after OTP verification', async () => {
    const { otpAuthentication, prisma, jwtService } = createAuthTestContext();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashTestOtp(TEST_USER.phone, '123456'),
      attemptCount: 0,
    });
    prisma.user.findUnique.mockResolvedValue(TEST_USER);

    const result = await otpAuthentication.verifyOtp({
      phone: TEST_USER.phone,
      code: '123456',
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: TEST_USER.id,
      phone: TEST_USER.phone,
      purpose: 'access',
    });
    expect(result).toMatchObject({
      isNewUser: false,
      data: { accessToken: 'access-token' },
    });
  });

  it('rejects verification when no active OTP exists', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.otpCode.findFirst.mockResolvedValue(null);

    await expect(
      otpAuthentication.verifyOtp({ phone: TEST_USER.phone, code: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.update).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('increments the attempt counter for an incorrect OTP', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.otpCode.update.mockResolvedValue({ attemptCount: 1 });
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashTestOtp(TEST_USER.phone, '123456'),
      attemptCount: 0,
    });

    await expect(
      otpAuthentication.verifyOtp({ phone: TEST_USER.phone, code: '654321' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-id' },
      data: { attemptCount: { increment: 1 } },
    });
  });

  it('safely rejects a malformed OTP hash stored in the database', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.otpCode.update.mockResolvedValue({ attemptCount: 1 });
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: '00',
      attemptCount: 0,
    });

    await expect(
      otpAuthentication.verifyOtp({ phone: TEST_USER.phone, code: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.update).toHaveBeenCalled();
  });

  it('invalidates the OTP after the fifth incorrect attempt', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.otpCode.update.mockResolvedValue({ attemptCount: 5 });
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashTestOtp(TEST_USER.phone, '123456'),
      attemptCount: 4,
    });

    await expect(
      otpAuthentication.verifyOtp({ phone: TEST_USER.phone, code: '654321' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'otp-id', isUsed: false },
      data: { isUsed: true },
    });
  });

  it('rejects an OTP consumed by a parallel request', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashTestOtp(TEST_USER.phone, '123456'),
      attemptCount: 0,
    });
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      otpAuthentication.verifyOtp({ phone: TEST_USER.phone, code: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks inactive users from logging in', async () => {
    const { otpAuthentication, prisma } = createAuthTestContext();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashTestOtp(TEST_USER.phone, '123456'),
      attemptCount: 0,
    });
    prisma.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      status: 'INACTIVE',
    });

    await expect(
      otpAuthentication.verifyOtp({ phone: TEST_USER.phone, code: '123456' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues a short-lived registration token for a new user', async () => {
    const { otpAuthentication, prisma, jwtService } = createAuthTestContext();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-id',
      codeHash: hashTestOtp(TEST_USER.phone, '123456'),
      attemptCount: 0,
    });
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await otpAuthentication.verifyOtp({
      phone: TEST_USER.phone,
      code: '123456',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'registration',
        phone: TEST_USER.phone,
        purpose: 'complete-registration',
      },
      { expiresIn: '5m' },
    );
    expect(result).toMatchObject({
      isNewUser: true,
      data: { registrationToken: 'registration-token' },
    });
  });
});
