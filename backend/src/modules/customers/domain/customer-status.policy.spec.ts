import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InternalRole, UserStatus } from '@prisma/client';
import { assertCustomerStatusChangeAllowed } from './customer-status.policy';

describe('assertCustomerStatusChangeAllowed', () => {
  it('allows an admin to apply any actual status change', () => {
    expect(() =>
      assertCustomerStatusChangeAllowed(
        UserStatus.ACTIVE,
        UserStatus.INACTIVE,
        [InternalRole.ADMIN],
      ),
    ).not.toThrow();
  });

  it.each([
    [UserStatus.ACTIVE, UserStatus.BLOCKED],
    [UserStatus.BLOCKED, UserStatus.ACTIVE],
  ])('allows support to change %s to %s', (current, next) => {
    expect(() =>
      assertCustomerStatusChangeAllowed(current, next, [InternalRole.SUPPORT]),
    ).not.toThrow();
  });

  it('prevents support from deactivating a customer', () => {
    expect(() =>
      assertCustomerStatusChangeAllowed(
        UserStatus.ACTIVE,
        UserStatus.INACTIVE,
        [InternalRole.SUPPORT],
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a no-op status update for every role', () => {
    expect(() =>
      assertCustomerStatusChangeAllowed(UserStatus.ACTIVE, UserStatus.ACTIVE, [
        InternalRole.ADMIN,
      ]),
    ).toThrow(BadRequestException);
  });
});
