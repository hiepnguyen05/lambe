import { registerAs } from '@nestjs/config';

export default registerAs('firebase', () => ({
  enabled: process.env.FIREBASE_ENABLED === 'true',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || '',
}));
