import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const createController = () => {
    const authService = {
      exchangeIdToken: jest.fn().mockResolvedValue({ success: true }),
      checkPhoneLink: jest.fn().mockResolvedValue({ success: true }),
      completeRegistration: jest.fn().mockResolvedValue({ success: true }),
      getCurrentUser: jest.fn().mockResolvedValue({ success: true }),
    };

    return {
      controller: new AuthController(
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

    await expect(controller.exchangeFirebaseToken(dto)).resolves.toEqual({
      success: true,
    });
    expect(authService.exchangeIdToken).toHaveBeenCalledWith(dto);
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

    await expect(controller.completeRegistration(dto)).resolves.toEqual({
      success: true,
    });
    expect(authService.completeRegistration).toHaveBeenCalledWith(dto);
  });

  it('uses the authenticated user id to load the current user', async () => {
    const { controller, authService } = createController();

    await expect(
      controller.getCurrentUser({
        userId: 'user-id',
        phone: '0363668951',
      }),
    ).resolves.toEqual({ success: true });
    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-id');
  });
});
