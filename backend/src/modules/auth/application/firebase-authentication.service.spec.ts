import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createAuthTestContext, TEST_USER } from '../testing/auth-test.factory';

describe('FirebaseAuthenticationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs in an active user after Firebase verifies the phone token', async () => {
    const { firebaseAuthentication, prisma, jwtService } =
      createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue(TEST_USER);

    const result = await firebaseAuthentication.exchangeIdToken({
      idToken: 'firebase-id-token',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { phone: TEST_USER.phone },
      include: { roles: true, customerProfile: true },
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: TEST_USER.id,
      phone: TEST_USER.phone,
      purpose: 'access',
    });
    expect(result).toMatchObject({
      data: {
        requiresPhoneVerification: false,
        isNewUser: false,
        accessToken: 'access-token',
      },
    });
  });

  it('issues a short-lived registration token for a new phone number', async () => {
    const { firebaseAuthentication, prisma, jwtService } =
      createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await firebaseAuthentication.exchangeIdToken({
      idToken: 'firebase-id-token',
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'registration',
        phone: TEST_USER.phone,
        firebaseUid: TEST_USER.firebaseUid,
        purpose: 'complete-registration',
      },
      { expiresIn: '5m' },
    );
    expect(result).toMatchObject({
      data: {
        requiresPhoneVerification: false,
        isNewUser: true,
        phone: TEST_USER.phone,
        registrationToken: 'registration-token',
      },
    });
  });

  it('blocks inactive users from logging in', async () => {
    const { firebaseAuthentication, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      status: 'BLOCKED',
    });

    await expect(
      firebaseAuthentication.exchangeIdToken({ idToken: 'firebase-id-token' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('links an existing pre-Firebase user on the first verified login', async () => {
    const { firebaseAuthentication, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      firebaseUid: null,
    });

    await firebaseAuthentication.exchangeIdToken({
      idToken: 'firebase-id-token',
    });

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: TEST_USER.id, firebaseUid: null },
      data: { firebaseUid: TEST_USER.firebaseUid },
    });
  });

  it('rejects a Firebase identity that does not match the linked user', async () => {
    const { firebaseAuthentication, prisma } = createAuthTestContext();
    prisma.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      firebaseUid: 'another-firebase-user',
    });

    await expect(
      firebaseAuthentication.exchangeIdToken({ idToken: 'firebase-id-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not query users when Firebase rejects the token', async () => {
    const { firebaseAuthentication, prisma, firebaseIdentityVerifier } =
      createAuthTestContext();
    firebaseIdentityVerifier.verifyIdToken.mockRejectedValue(
      new Error('invalid firebase token'),
    );

    await expect(
      firebaseAuthentication.exchangeIdToken({ idToken: 'invalid-token' }),
    ).rejects.toThrow('invalid firebase token');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires phone verification for a Google identity without a phone', async () => {
    const { firebaseAuthentication, prisma, firebaseIdentityVerifier } =
      createAuthTestContext();
    firebaseIdentityVerifier.verifyIdToken.mockResolvedValue({
      uid: 'google-firebase-user',
      signInProvider: 'google.com',
      email: 'customer@example.com',
      displayName: 'Nguyen Van B',
    });

    const result = await firebaseAuthentication.exchangeIdToken({
      idToken: 'google-id-token',
    });

    expect(result).toEqual({
      success: true,
      message:
        'Vui lòng xác minh số điện thoại để liên kết với tài khoản Lambe.',
      data: {
        requiresPhoneVerification: true,
        provider: 'google.com',
        email: 'customer@example.com',
        suggestedFullName: 'Nguyen Van B',
      },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows a social identity to pre-check an unused phone before linking', async () => {
    const { firebaseAuthentication, prisma, firebaseIdentityVerifier } =
      createAuthTestContext();
    firebaseIdentityVerifier.verifyIdToken.mockResolvedValue({
      uid: 'google-firebase-user',
      signInProvider: 'google.com',
      email: 'customer@example.com',
      displayName: 'Nguyen Van B',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await firebaseAuthentication.checkPhoneLink({
      idToken: 'google-id-token',
      phone: TEST_USER.phone,
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { phone: TEST_USER.phone },
      select: { id: true },
    });
    expect(result).toEqual({
      success: true,
      message: 'Số điện thoại có thể dùng để liên kết.',
      data: { canLink: true },
    });
  });

  it('blocks linking a social identity to a phone that already has an account', async () => {
    const { firebaseAuthentication, prisma, firebaseIdentityVerifier } =
      createAuthTestContext();
    firebaseIdentityVerifier.verifyIdToken.mockResolvedValue({
      uid: 'google-firebase-user',
      signInProvider: 'google.com',
      email: 'customer@example.com',
      displayName: 'Nguyen Van B',
    });
    prisma.user.findUnique.mockResolvedValue({ id: TEST_USER.id });

    await expect(
      firebaseAuthentication.checkPhoneLink({
        idToken: 'google-id-token',
        phone: TEST_USER.phone,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects phone-link pre-check when the Firebase identity already has a phone', async () => {
    const { firebaseAuthentication, prisma } = createAuthTestContext();

    await expect(
      firebaseAuthentication.checkPhoneLink({
        idToken: 'firebase-id-token',
        phone: TEST_USER.phone,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
