import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { InternalRolesGuard } from './internal-roles.guard';

describe('InternalRolesGuard', () => {
  const createContext = (roles: Array<'ADMIN' | 'MODERATOR'> = []) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({
        getRequest: () => ({
          internalAccount: roles.length
            ? {
                accountId: 'account-id',
                username: 'staff',
                roles,
                sessionId: 'session-id',
              }
            : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  const createGuard = (requiredRoles?: Array<'ADMIN' | 'MODERATOR'>) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    };

    return new InternalRolesGuard(reflector as never);
  };

  it('allows endpoints that do not declare internal roles', () => {
    expect(createGuard().canActivate(createContext())).toBe(true);
  });

  it.each([
    [['ADMIN'] as const, ['ADMIN'] as const],
    [['ADMIN', 'MODERATOR'] as const, ['MODERATOR'] as const],
  ])('allows an account with any required role', (requiredRoles, roles) => {
    expect(
      createGuard([...requiredRoles]).canActivate(createContext([...roles])),
    ).toBe(true);
  });

  it('rejects a moderator from an admin-only endpoint', () => {
    expect(() =>
      createGuard(['ADMIN']).canActivate(createContext(['MODERATOR'])),
    ).toThrow(ForbiddenException);
  });

  it('rejects a request without an authenticated internal account', () => {
    expect(() => createGuard(['ADMIN']).canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});
