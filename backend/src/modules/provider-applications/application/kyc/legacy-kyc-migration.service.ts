import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { KycCryptoService } from '../kyc/kyc-crypto.service';
import { claimProviderIdentity } from '../persistence/provider-identity-claim';
import { lockProviderApplication } from '../persistence/provider-application-lock';

const BATCH_SIZE = 100;

@Injectable()
export class LegacyKycMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LegacyKycMigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: KycCryptoService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.crypto.isConfigured()) {
      if (this.config.get<string>('app.nodeEnv') === 'production') {
        throw new Error('KYC encryption is required in production');
      }
      this.logger.warn(
        'KYC encryption is not configured; legacy KYC migration was skipped',
      );
      return;
    }

    let migrated = 0;
    while (true) {
      const applications = await this.prisma.providerApplication.findMany({
        where: {
          nationalIdNumber: { not: null },
          nationalIdEncrypted: null,
        },
        take: BATCH_SIZE,
        select: { id: true, userId: true, nationalIdNumber: true },
      });
      if (!applications.length) break;

      for (const application of applications) {
        if (!application.nationalIdNumber) continue;
        const protectedValue = this.crypto.protectNationalId(
          application.nationalIdNumber,
        );
        await this.prisma.$transaction(async (transaction) => {
          await lockProviderApplication(transaction, application.id);
          await claimProviderIdentity(
            transaction,
            protectedValue.hash,
            application.userId,
          );
          await transaction.providerApplication.updateMany({
            where: { id: application.id, nationalIdEncrypted: null },
            data: {
              nationalIdEncrypted: protectedValue.encrypted,
              nationalIdHash: protectedValue.hash,
              nationalIdLast4: protectedValue.last4,
              nationalIdNumber: null,
            },
          });
        });
        migrated += 1;
      }
    }

    if (migrated > 0) {
      this.logger.log(`Encrypted ${migrated} legacy KYC record(s)`);
    }
  }
}
