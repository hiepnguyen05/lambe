import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InternalRole } from '@prisma/client';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import { AdminProviderApplicationsController } from './admin-provider-applications.controller';

const guard = new InternalRolesGuard(new Reflector());

function context(
  method: keyof AdminProviderApplicationsController,
  roles: InternalRole[],
): ExecutionContext {
  return {
    getHandler: () =>
      Object.getOwnPropertyDescriptor(
        AdminProviderApplicationsController.prototype,
        method,
      )?.value as unknown,
    getClass: () => AdminProviderApplicationsController,
    switchToHttp: () => ({
      getRequest: () => ({ internalAccount: { roles } }),
    }),
  } as unknown as ExecutionContext;
}

describe('Provider application reviewer endpoint permissions', () => {
  const reviewerMethods = [
    'accessDocument',
    'reviewDocument',
    'requestChanges',
    'approve',
    'reject',
  ] as const;

  for (const method of reviewerMethods) {
    it.each([
      InternalRole.ADMIN,
      InternalRole.MODERATOR,
      InternalRole.KYC_REVIEWER,
    ])(`allows %s to ${method} independently`, (role) => {
      expect(guard.canActivate(context(method, [role]))).toBe(true);
    });

    it.each([InternalRole.SUPPORT, InternalRole.SERVICE_REVIEWER])(
      `forbids %s from ${method}`,
      (role) => {
        expect(() => guard.canActivate(context(method, [role]))).toThrow(
          ForbiddenException,
        );
      },
    );

    it(`requires assigned internal roles to ${method}`, () => {
      expect(() => guard.canActivate(context(method, []))).toThrow(
        ForbiddenException,
      );
    });
  }
});
