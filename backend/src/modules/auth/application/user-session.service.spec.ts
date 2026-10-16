import { UnauthorizedException } from '@nestjs/common';
import { UserSessionService } from './user-session.service';
import { TEST_USER } from '../testing/auth-test.factory';

describe('UserSessionService', () => {
  const now = new Date('2026-10-15T08:00:00.000Z');

  function context() {
    const session = {
      id: '8f8b6ff1-8df9-4a67-8598-9e4c6e37ff4b',
      userId: TEST_USER.id,
      refreshTokenHash: 'hash:refresh-token',
      expiresAt: new Date('2026-11-14T08:00:00.000Z'),
      revokedAt: null,
      user: TEST_USER,
    };
    const captured = {
      creates: [] as unknown[],
      updates: [] as unknown[],
    };
    const userSession = {
      create: jest
        .fn<Promise<typeof session>, [unknown]>()
        .mockImplementation((input) => {
          captured.creates.push(input);
          return Promise.resolve(session);
        }),
      findUnique: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue(session),
      updateMany: jest
        .fn<Promise<{ count: number }>, [unknown]>()
        .mockImplementation((input) => {
          captured.updates.push(input);
          return Promise.resolve({ count: 1 });
        }),
    };
    const transaction = { userSession };
    const prisma = {
      userSession,
      $transaction: jest.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const audit = { record: jest.fn() };
    const tokens = {
      createRefreshToken: jest.fn().mockReturnValue('next-refresh-token'),
      hashRefreshToken: jest.fn((token: string) => `hash:${token}`),
      getRefreshExpiry: jest
        .fn()
        .mockReturnValue(new Date('2026-11-14T08:00:00.000Z')),
      generateAccessToken: jest.fn().mockReturnValue('access-token'),
      getRefreshSessionId: jest.fn().mockReturnValue(session.id),
    };
    return {
      service: new UserSessionService(
        prisma as never,
        audit as never,
        tokens as never,
      ),
      prisma,
      userSession,
      audit,
      tokens,
      session,
      captured,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => jest.useRealTimers());

  it('creates a hashed refresh session and a session-bound access token', async () => {
    const { service, tokens, captured } = context();
    tokens.createRefreshToken.mockReturnValueOnce('refresh-token');
    const request = { ipAddress: '127.0.0.1', userAgent: 'mobile' };

    await expect(
      service.create(TEST_USER.id, TEST_USER.phone, request),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(captured.creates[0]).toMatchObject({
      data: {
        userId: TEST_USER.id,
        refreshTokenHash: 'hash:refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'mobile',
      },
    });
    expect(tokens.generateAccessToken).toHaveBeenCalledWith(
      TEST_USER.id,
      TEST_USER.phone,
      expect.any(String),
    );
  });

  it('rotates refresh tokens with a compare-and-swap update', async () => {
    const { service, captured } = context();

    const result = await service.refresh('refresh-token', {
      ipAddress: '127.0.0.2',
    });

    expect(captured.updates[0]).toMatchObject({
      where: {
        refreshTokenHash: 'hash:refresh-token',
        revokedAt: null,
      },
      data: {
        refreshTokenHash: 'hash:next-refresh-token',
        rotationCount: { increment: 1 },
      },
    });
    expect(result.data).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'next-refresh-token',
    });
  });

  it('rejects an expired or revoked refresh session', async () => {
    const { service, userSession, session } = context();
    userSession.findUnique.mockResolvedValue({ ...session, revokedAt: now });

    await expect(service.refresh('refresh-token', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userSession.updateMany).not.toHaveBeenCalled();
  });

  it('revokes a session when an old signed refresh token is replayed', async () => {
    const { service, userSession, audit, captured } = context();
    userSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: TEST_USER.id });

    await expect(
      service.refresh('replayed-refresh-token', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(captured.updates[0]).toMatchObject({
      where: {
        refreshTokenHash: { not: 'hash:replayed-refresh-token' },
      },
      data: { revokeReason: 'REFRESH_REPLAY' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_REFRESH_REPLAY' }),
      {},
      expect.anything(),
    );
  });

  it('revokes the current session on logout', async () => {
    const { service, audit, captured } = context();

    await expect(service.logout('refresh-token', {})).resolves.toEqual({
      success: true,
      message: 'Đăng xuất thành công.',
    });
    expect(captured.updates[0]).toMatchObject({
      where: { revokedAt: null },
      data: { revokeReason: 'LOGOUT' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_LOGOUT' }),
      {},
      expect.anything(),
    );
  });
});
