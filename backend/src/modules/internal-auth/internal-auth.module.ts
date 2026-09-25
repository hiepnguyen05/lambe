import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { InternalAccessVerifierService } from './application/internal-access-verifier.service';
import { InternalAuthenticationService } from './application/internal-authentication.service';
import { InternalSessionService } from './application/internal-session.service';
import { InternalTokenService } from './application/internal-token.service';
import { InternalAuthController } from './controllers/internal-auth.controller';
import { InternalJwtAuthGuard } from './guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from './guards/internal-roles.guard';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
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
  controllers: [InternalAuthController],
  providers: [
    InternalAuthenticationService,
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
