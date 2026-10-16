import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresDays: Number(
    process.env.USER_REFRESH_TOKEN_EXPIRES_DAYS ?? 30,
  ),
}));
