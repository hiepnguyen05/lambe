import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { MomoPaymentGateway } from '../../infrastructure/payment/momo-payment.gateway';
import { SePayPaymentGateway } from '../../infrastructure/payment/sepay-payment.gateway';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { WalletService } from './application/wallet.service';
import { WalletTopUpSettlementService } from './application/wallet-top-up-settlement.service';
import { MomoWebhookController } from './controllers/momo-webhook.controller';
import { ProviderWalletController } from './controllers/provider-wallet.controller';
import { SePayWebhookController } from './controllers/sepay-webhook.controller';

@Module({
  imports: [PostgresModule, AuditModule, AuthModule],
  controllers: [
    ProviderWalletController,
    MomoWebhookController,
    SePayWebhookController,
  ],
  providers: [
    WalletService,
    WalletTopUpSettlementService,
    MomoPaymentGateway,
    SePayPaymentGateway,
  ],
})
export class WalletModule {}
