import { Module } from '@nestjs/common';
import { KycCryptoService } from './kyc-crypto.service';

@Module({ providers: [KycCryptoService], exports: [KycCryptoService] })
export class KycModule {}
