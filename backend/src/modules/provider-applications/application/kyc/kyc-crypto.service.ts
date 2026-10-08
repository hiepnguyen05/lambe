import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LENGTH = 12;

export interface ProtectedNationalId {
  encrypted: string;
  hash: string;
  last4: string;
}

@Injectable()
export class KycCryptoService {
  private readonly key?: Buffer;

  constructor(config: ConfigService) {
    const encodedKey = config.get<string>('kyc.encryptionKey', '');
    if (encodedKey) {
      const key = Buffer.from(encodedKey, 'base64');
      if (key.length === 32) this.key = key;
    }
  }

  isConfigured(): boolean {
    return Boolean(this.key);
  }

  protectNationalId(value: string): ProtectedNationalId {
    const key = this.requireKey();
    const normalized = value.trim();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('lambe:provider-national-id:v1'));
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      encrypted: [
        VERSION,
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url'),
      ].join(':'),
      hash: this.hashNationalId(normalized),
      last4: normalized.slice(-4),
    };
  }

  revealNationalId(payload: string): string {
    const key = this.requireKey();
    const [version, iv, tag, encrypted] = payload.split(':');
    if (version !== VERSION || !iv || !tag || !encrypted) {
      throw new ServiceUnavailableException('Dữ liệu KYC không hợp lệ.');
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAAD(Buffer.from('lambe:provider-national-id:v1'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('Không thể giải mã dữ liệu KYC.');
    }
  }

  hashNationalId(value: string): string {
    return createHmac('sha256', this.requireKey())
      .update(`lambe:national-id:${value.trim()}`)
      .digest('hex');
  }

  maskNationalId(last4?: string | null): string | null {
    return last4 ? `********${last4}` : null;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'Hệ thống mã hóa KYC chưa được cấu hình.',
      );
    }
    return this.key;
  }
}
