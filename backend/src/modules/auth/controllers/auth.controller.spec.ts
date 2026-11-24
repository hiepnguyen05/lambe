import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const createController = () => {
    const authService = {
      exchangeIdToken: jest.fn().mockResolvedValue({ success: true }),
      checkPhoneLink: jest.fn().mockResolvedValue({ success: true }),
      completeRegistration: jest.fn().mockResolvedValue({ success: true }),
      getCurrentUser: jest.fn().mockResolvedValue({ success: true }),
      updateCurrentUser: jest.fn().mockResolvedValue({ success: true }),
      uploadAvatar: jest.fn().mockResolvedValue({ success: true }),
      removeAvatar: jest.fn().mockResolvedValue({ success: true }),
      refresh: jest.fn().mockResolvedValue({ success: true }),
      logout: jest.fn().mockResolvedValue({ success: true }),
    };

    return {
      controller: new AuthController(
        authService as never,
        authService as never,
        authService as never,
        authService as never,
      ),
      authService,
    };
  };

  it('forwards a Firebase ID token to the auth service', async () => {
    const { controller, authService } = createController();
    const dto = { idToken: 'firebase-id-token' };

    const request = { requestId: 'request-id' };
    await expect(
      controller.exchangeFirebaseToken(dto, request),
    ).resolves.toEqual({
      success: true,
    });
    expect(authService.exchangeIdToken).toHaveBeenCalledWith(dto, request);
  });

  it('forwards a Firebase phone-link pre-check to the auth service', async () => {
    const { controller, authService } = createController();
    const dto = {
      idToken: 'firebase-id-token',
      phone: '0363668951',
    };

    await expect(controller.checkFirebasePhoneLink(dto)).resolves.toEqual({
      success: true,
    });
    expect(authService.checkPhoneLink).toHaveBeenCalledWith(dto);
  });

  it('forwards registration completion to the auth service', async () => {
    const { controller, authService } = createController();
    const dto = { registrationToken: 'token', fullName: 'Nguyen Van A' };

    const request = { requestId: 'request-id' };
    await expect(
      controller.completeRegistration(dto, request),
    ).resolves.toEqual({
      success: true,
    });
    expect(authService.completeRegistration).toHaveBeenCalledWith(dto, request);
  });

  it('rotates and revokes user refresh sessions', async () => {
    const { controller, authService } = createController();
    const dto = { refreshToken: 'x'.repeat(150) };
    const request = { requestId: 'request-id' };

    await expect(controller.refresh(dto, request)).resolves.toEqual({
      success: true,
    });
    await expect(controller.logout(dto, request)).resolves.toEqual({
      success: true,
    });
    expect(authService.refresh).toHaveBeenCalledWith(dto.refreshToken, request);
    expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken, request);
  });

  it('uses the authenticated user id to load the current user', async () => {
    const { controller, authService } = createController();

    await expect(
      controller.getCurrentUser({
        userId: 'user-id',
        phone: '0363668951',
        sessionId: 'session-id',
      }),
    ).resolves.toEqual({ success: true });
    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-id');
  });

  it('uses the authenticated user id to update profile', async () => {
    const { controller, authService } = createController();
    const dto = { fullName: 'Nguyen Van B' };
    const request = { requestId: 'request-id' };

    await expect(
      controller.updateCurrentUser(
        { userId: 'user-id', phone: '0363668951', sessionId: 'session-id' },
        dto,
        request,
      ),
    ).resolves.toEqual({ success: true });

    expect(authService.updateCurrentUser).toHaveBeenCalledWith(
      'user-id',
      dto,
      request,
    );
  });

  it('uses the authenticated user id to upload avatar', async () => {
    const { controller, authService } = createController();
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;
    const request = { requestId: 'request-id' };

    await expect(
      controller.uploadAvatar(
        { userId: 'user-id', phone: '0363668951', sessionId: 'session-id' },
        file,
        request,
      ),
    ).resolves.toEqual({ success: true });

    expect(authService.uploadAvatar).toHaveBeenCalledWith(
      'user-id',
      file.buffer,
      request,
    );
  });

  it('uses the authenticated user id to remove avatar', async () => {
    const { controller, authService } = createController();
    const request = { requestId: 'request-id' };

    await expect(
      controller.removeAvatar(
        { userId: 'user-id', phone: '0363668951', sessionId: 'session-id' },
        request,
      ),
    ).resolves.toEqual({ success: true });

    expect(authService.removeAvatar).toHaveBeenCalledWith('user-id', request);
  });
});
