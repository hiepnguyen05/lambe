import { UnauthorizedException } from '@nestjs/common';
import {
  createInternalAccount,
  createInternalAuthTestContext,
  initializeInternalAuthFixture,
  INTERNAL_TEST_PASSWORD,
} from '../testing/internal-auth-test.factory';

describe('InternalAuthenticationService', () => {
  beforeAll(initializeInternalAuthFixture);
  beforeEach(() => jest.clearAllMocks());

  it('creates an internal session after a valid login', async () => {
    const { authenticationService, prisma, jwtService } =
      createInternalAuthTestContext();
    prisma.internalAccount.findUnique.mockResolvedValue(
      createInternalAccount(),
    );

    const result = await authenticationService.login(
      { username: ' ADMIN ', password: INTERNAL_TEST_PASSWORD },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(prisma.internalAccount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedUsername: 'admin' } }),
    );
    const createSessionInput = prisma.internalSession.create.mock
      .calls[0][0] as {
      data: { accountId: string; refreshTokenHash: string };
    };
    expect(createSessionInput.data.accountId).toBe('account-id');
    expect(createSessionInput.data.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.refreshToken).not.toHaveLength(0);
    expect(result.response.data.accessToken).toBe('internal-access-token');
    expect(result.response.data.account.roles).toEqual(['ADMIN']);
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'internal_access' }),
      { expiresIn: '15m' },
    );
  });

  it('increments failed attempts and locks at the configured threshold', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    const account = createInternalAccount();
    account.failedLoginCount = 4;
    prisma.internalAccount.findUnique.mockResolvedValue(account);

    await expect(
      authenticationService.login(
        { username: 'admin', password: 'incorrect-password-value' },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const updateAccountInput = prisma.internalAccount.update.mock
      .calls[0][0] as {
      where: { id: string };
      data: { failedLoginCount: number; status: string; lockedUntil: Date };
    };
    expect(updateAccountInput.where.id).toBe('account-id');
    expect(updateAccountInput.data).toMatchObject({
      failedLoginCount: 5,
      status: 'LOCKED',
    });
    expect(updateAccountInput.data.lockedUntil).toBeInstanceOf(Date);
    const auditInput = prisma.auditLog.create.mock.calls[0][0] as {
      data: { result: string };
    };
    expect(auditInput.data.result).toBe('ACCOUNT_LOCKED');
    expect(prisma.internalSession.create).not.toHaveBeenCalled();
  });

  it('returns the same generic error for an unknown username', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    prisma.internalAccount.findUnique.mockResolvedValue(null);

    await expect(
      authenticationService.login(
        { username: 'unknown', password: INTERNAL_TEST_PASSWORD },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const auditInput = prisma.auditLog.create.mock.calls[0][0] as {
      data: { result: string; metadata: { normalizedUsername: string } };
    };
    expect(auditInput.data).toMatchObject({
      result: 'INVALID_CREDENTIALS',
      metadata: { normalizedUsername: 'unknown' },
    });
  });

  it.each(['DISABLED', 'INVITED', 'LOCKED'] as const)(
    'rejects an unavailable %s account even with the correct password',
    async (status) => {
      const { authenticationService, prisma } = createInternalAuthTestContext();
      prisma.internalAccount.findUnique.mockResolvedValue({
        ...createInternalAccount(),
        status,
        lockedUntil: status === 'LOCKED' ? new Date(Date.now() + 60_000) : null,
      });

      await expect(
        authenticationService.login(
          { username: 'admin', password: INTERNAL_TEST_PASSWORD },
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.internalSession.create).not.toHaveBeenCalled();
      const auditInput = prisma.auditLog.create.mock.calls[0][0] as {
        data: { result: string };
      };
      expect(auditInput.data.result).toBe('ACCOUNT_UNAVAILABLE');
    },
  );

  it('reactivates a locked account after the lock duration expires', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    const unlockedAccount = createInternalAccount();
    prisma.internalAccount.findUnique.mockResolvedValue({
      ...unlockedAccount,
      status: 'LOCKED',
      lockedUntil: new Date(Date.now() - 1_000),
    });
    prisma.internalAccount.update
      .mockResolvedValueOnce(unlockedAccount)
      .mockResolvedValue({});

    await expect(
      authenticationService.login(
        { username: 'admin', password: INTERNAL_TEST_PASSWORD },
        {},
      ),
    ).resolves.toMatchObject({ response: { success: true } });
    expect(prisma.internalAccount.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'account-id' },
      data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
      include: expect.any(Object) as object,
    });
  });

  it('rejects an internal account without credentials', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    prisma.internalAccount.findUnique.mockResolvedValue({
      ...createInternalAccount(),
      credential: null,
    });

    await expect(
      authenticationService.login(
        { username: 'admin', password: INTERNAL_TEST_PASSWORD },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.internalSession.create).not.toHaveBeenCalled();
  });

  it('safely rejects a corrupted internal password hash', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    const account = createInternalAccount();
    prisma.internalAccount.findUnique.mockResolvedValue({
      ...account,
      credential: { ...account.credential, passwordHash: 'corrupted-hash' },
    });

    await expect(
      authenticationService.login(
        { username: 'admin', password: INTERNAL_TEST_PASSWORD },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.internalSession.create).not.toHaveBeenCalled();
  });

  it('rejects an internal account without an active role', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    prisma.internalAccount.findUnique.mockResolvedValue({
      ...createInternalAccount(),
      roles: [],
    });

    await expect(
      authenticationService.login(
        { username: 'admin', password: INTERNAL_TEST_PASSWORD },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.internalSession.create).not.toHaveBeenCalled();
  });
});
