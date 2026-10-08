import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createAuthTestContext, TEST_USER } from '../testing/auth-test.factory';

describe('UserProfileService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the current active user', async () => {
    const { userProfile, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue(TEST_USER);

    await expect(userProfile.getCurrentUser(TEST_USER.id)).resolves.toEqual({
      success: true,
      data: {
        user: {
          id: TEST_USER.id,
          phone: TEST_USER.phone,
          fullName: TEST_USER.fullName,
          avatarUrl: null,
          status: TEST_USER.status,
          roles: ['CUSTOMER'],
          gender: null,
          preferredAudience: 'ALL',
          pricePreference: 'NO_PREFERENCE',
          onboardingStatus: 'NOT_STARTED',
          createdAt: TEST_USER.createdAt,
          updatedAt: TEST_USER.updatedAt,
        },
      },
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

  it('updates the current user profile', async () => {
    const { userProfile, prisma, auditService } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue(TEST_USER);

    await expect(
      userProfile.updateCurrentUser(
        TEST_USER.id,
        { fullName: 'Nguyen Van B', gender: 'MALE' },
        { requestId: 'request-id' },
      ),
    ).resolves.toMatchObject({
      success: true,
      data: { user: { id: TEST_USER.id } },
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TEST_USER.id },
      data: { fullName: 'Nguyen Van B' },
    });
    expect(prisma.customerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: TEST_USER.id },
      update: { gender: 'MALE' },
      create: { userId: TEST_USER.id, gender: 'MALE' },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_PROFILE_UPDATED' }),
      { requestId: 'request-id' },
      expect.any(Object),
    );
  });

  it('rejects an empty profile update payload', async () => {
    const { userProfile } = createAuthTestContext();

    await expect(
      userProfile.updateCurrentUser(TEST_USER.id, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploads and replaces the current user avatar', async () => {
    const { userProfile, prisma, mediaStorage } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      avatarPublicId: 'old-avatar',
    });

    await expect(
      userProfile.uploadAvatar(TEST_USER.id, Buffer.from('image')),
    ).resolves.toMatchObject({
      success: true,
      data: { user: { id: TEST_USER.id } },
    });

    expect(mediaStorage.uploadImage).toHaveBeenCalledWith(
      Buffer.from('image'),
      `lambe/users/${TEST_USER.id}/avatar`,
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: TEST_USER.id, updatedAt: TEST_USER.updatedAt },
      data: {
        avatarUrl: 'https://res.cloudinary.com/lambe/avatar.jpg',
        avatarPublicId: 'lambe/users/user-id/avatar/image',
      },
    });
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith('old-avatar');
  });
});
