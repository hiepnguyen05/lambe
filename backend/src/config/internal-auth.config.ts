import { registerAs } from '@nestjs/config';

export default registerAs('internalAuth', () => ({
  jwtSecret: process.env.INTERNAL_JWT_SECRET as string,
  accessTokenExpiresIn: process.env.INTERNAL_ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresDays: Number(
    process.env.INTERNAL_REFRESH_TOKEN_EXPIRES_DAYS || 7,
  ),
  maxFailedAttempts: Number(process.env.INTERNAL_MAX_FAILED_ATTEMPTS || 5),
  lockDurationMinutes: Number(process.env.INTERNAL_LOCK_DURATION_MINUTES || 15),
  refreshCookieName:
    process.env.INTERNAL_REFRESH_COOKIE_NAME || 'lambe_internal_refresh',
}));
