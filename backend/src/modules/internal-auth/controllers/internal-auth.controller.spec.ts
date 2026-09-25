import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InternalAuthController } from './internal-auth.controller';

describe('InternalAuthController', () => {
  const requestMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest-agent',
  };

  const createController = (nodeEnv = 'development') => {
    const internalAuthService = {
      login: jest.fn().mockResolvedValue({
        refreshToken: 'refresh-token',
        response: { success: true, operation: 'login' },
      }),
      refresh: jest.fn().mockResolvedValue({
        refreshToken: 'rotated-refresh-token',
        response: { success: true, operation: 'refresh' },
      }),
      logout: jest.fn().mockResolvedValue({ success: true }),
      getCurrentAccount: jest.fn().mockResolvedValue({ success: true }),
    };
    const config = new Map<string, unknown>([
      ['internalAuth.refreshCookieName', 'internal_refresh'],
      ['internalAuth.refreshTokenExpiresDays', 7],
      ['app.nodeEnv', nodeEnv],
    ]);
    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        config.has(key) ? config.get(key) : defaultValue,
      ),
    };
    const controller = new InternalAuthController(
      internalAuthService as never,
      internalAuthService as never,
      configService as never,
    );
    const createRequest = (cookie?: string) =>
      ({
        ip: '127.0.0.1',
        headers: { cookie },
        get: jest.fn().mockReturnValue('jest-agent'),
      }) as unknown as Request;
    const responseMock = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    const response = responseMock as unknown as Response;

    return {
      controller,
      internalAuthService,
      createRequest,
      response,
      responseMock,
    };
  };

  it('logs in and sets a development refresh cookie', async () => {
    const { controller, internalAuthService, response, responseMock } =
      createController();
    const dto = {
      username: 'admin',
      password: 'A-strong-admin-password-2026',
    };

    await expect(
      controller.login(dto, requestMetadata, response),
    ).resolves.toEqual({ success: true, operation: 'login' });
    expect(internalAuthService.login).toHaveBeenCalledWith(dto, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest-agent',
    });
    expect(responseMock.cookie).toHaveBeenCalledWith(
      'internal_refresh',
      'refresh-token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/admin/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    );
  });

  it('marks the refresh cookie secure in production', async () => {
    const { controller, response, responseMock } =
      createController('production');

    await controller.login(
      { username: 'admin', password: 'A-strong-admin-password-2026' },
      requestMetadata,
      response,
    );

    expect(responseMock.cookie).toHaveBeenCalledWith(
      'internal_refresh',
      'refresh-token',
      expect.objectContaining({ secure: true }),
    );
  });

  it('rotates the refresh token read from the cookie', async () => {
    const {
      controller,
      internalAuthService,
      createRequest,
      response,
      responseMock,
    } = createController();

    await expect(
      controller.refresh(
        createRequest('another=value; internal_refresh=current-token'),
        requestMetadata,
        response,
      ),
    ).resolves.toEqual({ success: true, operation: 'refresh' });
    expect(internalAuthService.refresh).toHaveBeenCalledWith('current-token', {
      ipAddress: '127.0.0.1',
      userAgent: 'jest-agent',
    });
    expect(responseMock.cookie).toHaveBeenCalledWith(
      'internal_refresh',
      'rotated-refresh-token',
      expect.any(Object),
    );
  });

  it('rejects refresh when its cookie is missing', async () => {
    const { controller, internalAuthService, createRequest, response } =
      createController();

    await expect(
      controller.refresh(createRequest(), requestMetadata, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(internalAuthService.refresh).not.toHaveBeenCalled();
  });

  it('logs out idempotently and clears the refresh cookie', async () => {
    const {
      controller,
      internalAuthService,
      createRequest,
      response,
      responseMock,
    } = createController();

    await expect(
      controller.logout(createRequest(), requestMetadata, response),
    ).resolves.toEqual({ success: true });
    expect(internalAuthService.logout).toHaveBeenCalledWith(undefined, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest-agent',
    });
    expect(responseMock.clearCookie).toHaveBeenCalledWith('internal_refresh', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api/admin/auth',
    });
  });

  it('loads the current internal account by its authenticated id', async () => {
    const { controller, internalAuthService } = createController();

    await expect(
      controller.me({
        accountId: 'account-id',
        username: 'admin',
        roles: ['ADMIN'],
        sessionId: 'session-id',
      }),
    ).resolves.toEqual({ success: true });
    expect(internalAuthService.getCurrentAccount).toHaveBeenCalledWith(
      'account-id',
    );
  });
});
