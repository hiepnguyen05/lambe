import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const createGuard = () => {
    const request = {
      headers: { authorization: 'Bearer access-token' },
    } as { headers: { authorization?: string }; user?: unknown };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        phone: '0363668951',
        purpose: 'access',
      }),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          phone: '0363668951',
          status: 'ACTIVE',
        }),
      },
    };
    const guard = new JwtAuthGuard(jwtService as never, prisma as never);

    return { guard, request, context, jwtService, prisma };
  };

  it('accepts a valid access token for an active user', async () => {
    const { guard, request, context } = createGuard();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      userId: 'user-id',
      phone: '0363668951',
    });
  });

  it('rejects registration tokens on protected endpoints', async () => {
    const { guard, context, jwtService } = createGuard();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'registration',
      phone: '0363668951',
      purpose: 'complete-registration',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects tokens belonging to inactive users', async () => {
    const { guard, context, prisma } = createGuard();
    prisma.user.findUnique.mockResolvedValue({
      phone: '0363668951',
      status: 'INACTIVE',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([undefined, '', 'Basic access-token', 'Bearer'])(
    'rejects a missing or malformed authorization header: %s',
    async (authorization) => {
      const { guard, context, request, jwtService } = createGuard();
      request.headers.authorization = authorization;

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    },
  );

  it('rejects an expired or invalid JWT', async () => {
    const { guard, context, jwtService } = createGuard();
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    ['missing user', null],
    ['mismatched phone', { phone: '0987654321', status: 'ACTIVE' }],
  ])('rejects a valid token for a %s', async (_caseName, databaseUser) => {
    const { guard, context, prisma } = createGuard();
    prisma.user.findUnique.mockResolvedValue(databaseUser);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
