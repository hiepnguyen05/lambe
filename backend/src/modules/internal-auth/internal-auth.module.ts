import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { InternalAccessVerifierService } from './application/internal-access-verifier.service';
import { InternalAccountSetupService } from './application/internal-account-setup.service';
import { InternalAccountsService } from './application/internal-accounts.service';
import { InternalAuditQueryService } from './application/internal-audit-query.service';
import { InternalAuthenticationService } from './application/internal-authentication.service';
import { InternalSessionService } from './application/internal-session.service';
import { InternalTokenService } from './application/internal-token.service';
import { InternalAuthController } from './controllers/internal-auth.controller';
import { InternalAccountsController } from './controllers/internal-accounts.controller';
import { InternalAuditController } from './controllers/internal-audit.controller';
import { InternalJwtAuthGuard } from './guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from './guards/internal-roles.guard';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('internalAuth.jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string>(
            'internalAuth.accessTokenExpiresIn',
            '15m',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [
    InternalAuthController,
    InternalAccountsController,
    InternalAuditController,
  ],
  providers: [
    InternalAuthenticationService,
    InternalAccountSetupService,
    InternalAccountsService,
    InternalAuditQueryService,
    InternalAccessVerifierService,
    InternalSessionService,
    InternalTokenService,
    InternalJwtAuthGuard,
    InternalRolesGuard,
  ],
  exports: [
    InternalAccessVerifierService,
    InternalJwtAuthGuard,
    InternalRolesGuard,
  ],
})
export class InternalAuthModule {}
