import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createAuthTestContext, TEST_USER } from '../testing/auth-test.factory';

describe('UserProfileService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the current active user', async () => {
    const { userProfile, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue(TEST_USER);

    await expect(userProfile.getCurrentUser(TEST_USER.id)).resolves.toEqual({
      success: true,
      data: { user: TEST_USER },
    });
  });

  it('rejects a missing current user', async () => {
    const { userProfile, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(userProfile.getCurrentUser('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an inactive current user', async () => {
    const { userProfile, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      status: 'BLOCKED',
    });

    await expect(
      userProfile.getCurrentUser(TEST_USER.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
