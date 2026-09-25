import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { InternalAccessVerifierService } from '../application/internal-access-verifier.service';
import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';

describe('InternalJwtAuthGuard', () => {
  const createContext = (authorization = 'Bearer access-token') => {
    const request: {
      headers: { authorization?: string };
      internalAccount?: unknown;
    } = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;

    return { context, request };
  };

  const createGuard = () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'account-id',
        username: 'admin',
        roles: ['ADMIN'],
        sessionId: 'session-id',
        tokenVersion: 0,
        purpose: 'internal_access',
      }),
    };
    const prisma = {
      internalSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-id',
          accountId: 'account-id',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          account: {
            id: 'account-id',
            username: 'admin',
            status: 'ACTIVE',
            tokenVersion: 0,
            roles: [{ role: 'ADMIN' }],
          },
        }),
      },
    };
    const verifier = new InternalAccessVerifierService(
      jwtService as never,
      prisma as never,
    );
    const guard = new InternalJwtAuthGuard(verifier);

    return { guard, jwtService, prisma };
  };

  it('attaches an authenticated internal account for a valid session', async () => {
    const { guard } = createGuard();
    const { context, request } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.internalAccount).toEqual({
      accountId: 'account-id',
      username: 'admin',
      roles: ['ADMIN'],
      sessionId: 'session-id',
    });
  });

  it('rejects a regular user access token', async () => {
    const { guard, jwtService, prisma } = createGuard();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      purpose: 'access',
    });

    await expect(
      guard.canActivate(createContext().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.internalSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a revoked internal session', async () => {
    const { guard, prisma } = createGuard();
    prisma.internalSession.findUnique.mockResolvedValue({
      id: 'session-id',
      accountId: 'account-id',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      account: {
        id: 'account-id',
        username: 'admin',
        status: 'ACTIVE',
        tokenVersion: 0,
        roles: [{ role: 'ADMIN' }],
      },
    });

    await expect(
      guard.canActivate(createContext().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects requests without a bearer token', async () => {
    const { guard } = createGuard();

    await expect(
      guard.canActivate(createContext('').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired or invalid internal JWT', async () => {
    const { guard, jwtService } = createGuard();
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guard.canActivate(createContext().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['missing session', null],
    [
      'expired session',
      {
        id: 'session-id',
        accountId: 'account-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
        account: {
          id: 'account-id',
          username: 'admin',
          status: 'ACTIVE',
          tokenVersion: 0,
          roles: [{ role: 'ADMIN' }],
        },
      },
    ],
    [
      'account mismatch',
      {
        id: 'session-id',
        accountId: 'another-account',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        account: {
          id: 'another-account',
          username: 'admin',
          status: 'ACTIVE',
          tokenVersion: 0,
          roles: [{ role: 'ADMIN' }],
        },
      },
    ],
    [
      'stale token version',
      {
        id: 'session-id',
        accountId: 'account-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        account: {
          id: 'account-id',
          username: 'admin',
          status: 'ACTIVE',
          tokenVersion: 1,
          roles: [{ role: 'ADMIN' }],
        },
      },
    ],
    [
      'role-less account',
      {
        id: 'session-id',
        accountId: 'account-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        account: {
          id: 'account-id',
          username: 'admin',
          status: 'ACTIVE',
          tokenVersion: 0,
          roles: [],
        },
      },
    ],
  ])('rejects a %s', async (_caseName, session) => {
    const { guard, prisma } = createGuard();
    prisma.internalSession.findUnique.mockResolvedValue(session);

    await expect(
      guard.canActivate(createContext().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
