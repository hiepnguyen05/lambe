import { CustomerOnboardingStatus } from '@prisma/client';
import { FirebaseAuthenticationService } from '../application/firebase-authentication.service';
import { UserProfileService } from '../application/user-profile.service';
import { UserRegistrationService } from '../application/user-registration.service';
import { UserTokenService } from '../application/user-token.service';

export const TEST_USER = {
  id: 'user-id',
  phone: '0363668951',
  firebaseUid: 'firebase-user-id',
  fullName: 'Nguyen Van A',
  avatarUrl: null,
  avatarPublicId: null,
  status: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  roles: [{ role: 'CUSTOMER' as const }],
  customerProfile: {
    gender: null,
    preferredAudience: 'ALL' as const,
    pricePreference: 'NO_PREFERENCE' as const,
    onboardingStatus: CustomerOnboardingStatus.NOT_STARTED,
  },
};

export function createAuthTestContext() {
  const prisma = {
    user: {
      create: jest.fn().mockResolvedValue(TEST_USER),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(TEST_USER),
      update: jest.fn().mockResolvedValue(TEST_USER),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customerProfile: {
      upsert: jest.fn().mockResolvedValue(TEST_USER.customerProfile),
    },
  };
  const prismaWithTransaction = {
    ...prisma,
    $transaction: jest.fn((callback: (transaction: typeof prisma) => unknown) =>
      callback(prisma),
    ),
  };
  const auditService = {
    record: jest.fn(),
  };
  const mediaStorage = {
    uploadImage: jest.fn().mockResolvedValue({
      url: 'https://res.cloudinary.com/lambe/avatar.jpg',
      secureUrl: 'https://res.cloudinary.com/lambe/avatar.jpg',
      publicId: 'lambe/users/user-id/avatar/image',
      format: 'jpg',
      resourceType: 'image',
      deliveryType: 'upload' as const,
    }),
    uploadPrivateImage: jest.fn(),
    createPrivateDownloadUrl: jest.fn(),
    deleteImage: jest.fn().mockResolvedValue(true),
  };
  const firebaseIdentityVerifier = {
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'firebase-user-id',
      signInProvider: 'phone',
      phoneNumber: '+84363668951',
    }),
  };
  const jwtService = {
    sign: jest.fn((payload: { purpose: string }) =>
      payload.purpose === 'access' ? 'access-token' : 'registration-token',
    ),
    verifyAsync: jest.fn(),
  };
  const tokenService = new UserTokenService(jwtService as never);

  return {
    firebaseAuthentication: new FirebaseAuthenticationService(
      prismaWithTransaction as never,
      firebaseIdentityVerifier,
      tokenService,
    ),
    registration: new UserRegistrationService(
      prismaWithTransaction as never,
      tokenService,
    ),
    userProfile: new UserProfileService(
      prismaWithTransaction as never,
      auditService as never,
      mediaStorage,
    ),
    prisma: prismaWithTransaction,
    auditService,
    mediaStorage,
    firebaseIdentityVerifier,
    jwtService,
  };
}
