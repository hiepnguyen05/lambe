import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FirebaseModule } from '../../infrastructure/firebase/firebase.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { UploadModule } from '../upload/upload.module';
import { FirebaseAuthenticationService } from './application/firebase-authentication.service';
import { UserProfileService } from './application/user-profile.service';
import { UserRegistrationService } from './application/user-registration.service';
import { UserTokenService } from './application/user-token.service';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PostgresModule,
    FirebaseModule,
    AuditModule,
    UploadModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = (configService.get<string>('security.jwtExpiresIn') ||
          '7d') as JwtSignOptions['expiresIn'];

        return {
          secret: configService.getOrThrow<string>('security.jwtSecret'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    FirebaseAuthenticationService,
    UserRegistrationService,
    UserProfileService,
    UserTokenService,
    JwtAuthGuard,
  ],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
