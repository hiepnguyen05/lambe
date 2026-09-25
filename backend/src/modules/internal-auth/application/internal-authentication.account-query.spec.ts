import { UnauthorizedException } from '@nestjs/common';
import {
  createInternalAccount,
  createInternalAuthTestContext,
  initializeInternalAuthFixture,
} from '../testing/internal-auth-test.factory';

describe('InternalAuthenticationService account query', () => {
  beforeAll(initializeInternalAuthFixture);
  beforeEach(() => jest.clearAllMocks());

  it('returns the active internal account', async () => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    prisma.internalAccount.findUnique.mockResolvedValue(
      createInternalAccount(),
    );

    await expect(
      authenticationService.getCurrentAccount('account-id'),
    ).resolves.toMatchObject({
      success: true,
      data: {
        account: {
          id: 'account-id',
          username: 'admin',
          roles: ['ADMIN'],
        },
      },
    });
  });

  it.each([
    ['missing', null],
    ['disabled', () => ({ ...createInternalAccount(), status: 'DISABLED' })],
  ])('rejects a %s internal account lookup', async (_caseName, fixture) => {
    const { authenticationService, prisma } = createInternalAuthTestContext();
    const account = typeof fixture === 'function' ? fixture() : fixture;
    prisma.internalAccount.findUnique.mockResolvedValue(account);

    await expect(
      authenticationService.getCurrentAccount('account-id'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
