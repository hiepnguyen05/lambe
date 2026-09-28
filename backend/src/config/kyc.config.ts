import { registerAs } from '@nestjs/config';

export default registerAs('kyc', () => ({
  encryptionKey: process.env.KYC_ENCRYPTION_KEY || '',
}));
