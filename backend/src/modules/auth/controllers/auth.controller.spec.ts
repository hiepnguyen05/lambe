import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const createController = () => {
    const authService = {
      sendOtp: jest.fn().mockResolvedValue({ success: true }),
      verifyOtp: jest.fn().mockResolvedValue({ success: true }),
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

  it('forwards an OTP request to the auth service', async () => {
    const { controller, authService } = createController();
    const dto = { phone: '0363668951' };

    await expect(controller.sendOtp(dto)).resolves.toEqual({ success: true });
    expect(authService.sendOtp).toHaveBeenCalledWith(dto);
  });

  it('forwards OTP verification to the auth service', async () => {
    const { controller, authService } = createController();
    const dto = { phone: '0363668951', code: '123456' };

    await expect(controller.verifyOtp(dto)).resolves.toEqual({ success: true });
    expect(authService.verifyOtp).toHaveBeenCalledWith(dto);
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
