import { ConfigService } from '@nestjs/config';
import { KycCryptoService } from '../kyc/kyc-crypto.service';

describe('KycCryptoService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const createService = (encryptionKey = key) =>
    new KycCryptoService({
      get: jest.fn().mockReturnValue(encryptionKey),
    } as unknown as ConfigService);

  it('encrypts, hashes and masks a national id without storing plaintext', () => {
    const service = createService();
    const result = service.protectNationalId('001095012345');

    expect(result.encrypted).not.toContain('001095012345');
    expect(result.hash).toHaveLength(64);
    expect(result.last4).toBe('2345');
    expect(service.revealNationalId(result.encrypted)).toBe('001095012345');
    expect(service.maskNationalId(result.last4)).toBe('********2345');
  });

  it('uses randomized authenticated encryption', () => {
    const service = createService();
    const first = service.protectNationalId('001095012345');
    const second = service.protectNationalId('001095012345');

    expect(first.encrypted).not.toBe(second.encrypted);
    expect(first.hash).toBe(second.hash);
  });

  it('fails closed when no encryption key is configured', () => {
    const service = createService('');
    expect(() => service.protectNationalId('001095012345')).toThrow(
      'Hệ thống mã hóa KYC chưa được cấu hình.',
    );
  });
});
