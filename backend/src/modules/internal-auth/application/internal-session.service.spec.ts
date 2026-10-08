import { UnauthorizedException } from '@nestjs/common';
import {
  createInternalAccount,
  createInternalAuthTestContext,
  initializeInternalAuthFixture,
} from '../testing/internal-auth-test.factory';

describe('InternalSessionService', () => {
  const sessionId = '123e4567-e89b-42d3-a456-426614174000';
  beforeAll(initializeInternalAuthFixture);
  beforeEach(() => jest.clearAllMocks());

  it('rotates a valid refresh token before issuing a new access token', async () => {
    const { sessionService, prisma } = createInternalAuthTestContext();
    const account = createInternalAccount();
    prisma.internalSession.findUnique.mockResolvedValue({
      id: sessionId,
      accountId: account.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      account,
    });

    const result = await sessionService.refresh('current-refresh-token', {});

    const rotateSessionInput = prisma.internalSession.updateMany.mock
      .calls[0][0] as {
      where: { id: string; revokedAt: null };
      data: { rotationCount: { increment: number }; refreshTokenHash: string };
    };
    expect(rotateSessionInput.where).toMatchObject({
      id: sessionId,
      revokedAt: null,
    });
    expect(rotateSessionInput.data.rotationCount).toEqual({ increment: 1 });
    expect(rotateSessionInput.data.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.refreshToken).not.toBe('current-refresh-token');
    expect(result.response.data.accessToken).toBe('internal-access-token');
  });

  it('revokes the session when a rotated refresh token is replayed', async () => {
    const { sessionService, tokenService, prisma } =
      createInternalAuthTestContext();
    const oldToken = tokenService.createRefreshToken(sessionId);
    prisma.internalSession.findUnique.mockResolvedValueOnce(null);

    await expect(sessionService.refresh(oldToken, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.internalSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        refreshTokenHash: { not: tokenService.hashRefreshToken(oldToken) },
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
        revokeReason: 'REFRESH_REPLAY',
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'INTERNAL_REFRESH_REPLAY',
        resourceId: sessionId,
        result: 'REVOKED',
      }) as object,
    });
  });

  it('does not revoke a session for a forged refresh token', async () => {
    const { sessionService, tokenService, prisma } =
      createInternalAuthTestContext();
    const validToken = tokenService.createRefreshToken(sessionId);
    const forgedToken = `${validToken.slice(0, -1)}${validToken.endsWith('a') ? 'b' : 'a'}`;
    prisma.internalSession.findUnique.mockResolvedValue(null);

    await expect(
      sessionService.refresh(forgedToken, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.internalSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a refresh token that lost the rotation race', async () => {
    const { sessionService, prisma } = createInternalAuthTestContext();
    const account = createInternalAccount();
    prisma.internalSession.findUnique.mockResolvedValue({
      id: 'session-id',
      accountId: account.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      account,
    });
    prisma.internalSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      sessionService.refresh('reused-refresh-token', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['missing session', null],
    [
      'revoked session',
      {
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        account: createInternalAccount,
      },
    ],
    [
      'expired session',
      {
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
        account: createInternalAccount,
      },
    ],
    [
      'disabled account',
      {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        account: () => ({ ...createInternalAccount(), status: 'DISABLED' }),
      },
    ],
    [
      'account without roles',
      {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        account: () => ({ ...createInternalAccount(), roles: [] }),
      },
    ],
  ])('rejects refresh for a %s', async (_caseName, sessionFixture) => {
    const { sessionService, prisma } = createInternalAuthTestContext();
    const session = sessionFixture
      ? { ...sessionFixture, account: sessionFixture.account() }
      : null;
    prisma.internalSession.findUnique.mockResolvedValue(session);

    await expect(
      sessionService.refresh('invalid-refresh-token', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.internalSession.updateMany).not.toHaveBeenCalled();
  });

  it('revokes an active session on logout and records an audit entry', async () => {
    const { sessionService, prisma } = createInternalAuthTestContext();
    prisma.internalSession.findUnique.mockResolvedValue({
      id: 'session-id',
      accountId: 'account-id',
      revokedAt: null,
    });

    await expect(
      sessionService.logout('refresh-token', {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(prisma.internalSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date, revokeReason: 'LOGOUT' },
    });
    const auditInput = prisma.auditLog.create.mock.calls[0][0] as {
      data: { action: string; actorInternalAccountId: string; result: string };
    };
    expect(auditInput.data).toMatchObject({
      action: 'INTERNAL_LOGOUT',
      actorInternalAccountId: 'account-id',
      result: 'SUCCESS',
    });
  });

  it('logs out with a previously rotated signed refresh token', async () => {
    const { sessionService, tokenService, prisma } =
      createInternalAuthTestContext();
    const oldToken = tokenService.createRefreshToken(sessionId);
    prisma.internalSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: sessionId,
        accountId: 'account-id',
        revokedAt: null,
      });

    await expect(sessionService.logout(oldToken, {})).resolves.toMatchObject({
      success: true,
    });
    expect(prisma.internalSession.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: sessionId },
    });
    expect(prisma.internalSession.updateMany).toHaveBeenCalledWith({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date, revokeReason: 'LOGOUT' },
    });
  });

  it.each([
    ['without a token', undefined, undefined],
    ['with an unknown token', 'unknown-token', null],
    [
      'with an already revoked session',
      'revoked-token',
      { id: 'session-id', accountId: 'account-id', revokedAt: new Date() },
    ],
  ])('keeps logout idempotent %s', async (_caseName, refreshToken, session) => {
    const { sessionService, prisma } = createInternalAuthTestContext();
    prisma.internalSession.findUnique.mockResolvedValue(session);

    await expect(
      sessionService.logout(refreshToken, {}),
    ).resolves.toMatchObject({ success: true });
    expect(prisma.internalSession.updateMany).not.toHaveBeenCalled();
  });
});
