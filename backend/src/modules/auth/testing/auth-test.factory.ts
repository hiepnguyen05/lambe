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
  status: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  roles: [{ role: 'CUSTOMER' as const }],
  customerProfile: {
    onboardingStatus: CustomerOnboardingStatus.NOT_STARTED,
  },
};

export function createAuthTestContext() {
  const prisma = {
    user: {
      create: jest.fn().mockResolvedValue(TEST_USER),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customerProfile: {
      upsert: jest.fn().mockResolvedValue(TEST_USER.customerProfile),
    },
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
      prisma as never,
      firebaseIdentityVerifier,
      tokenService,
    ),
    registration: new UserRegistrationService(prisma as never, tokenService),
    userProfile: new UserProfileService(prisma as never),
    prisma,
    firebaseIdentityVerifier,
    jwtService,
  };
}
