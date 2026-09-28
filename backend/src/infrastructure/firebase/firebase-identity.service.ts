import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import {
  SUPPORTED_FIREBASE_SIGN_IN_PROVIDERS,
  type FirebaseIdentityVerifier,
  type SupportedFirebaseSignInProvider,
  type VerifiedFirebaseIdentity,
} from '../../modules/auth/application/firebase-identity-verifier.port';

@Injectable()
export class FirebaseIdentityService
  implements FirebaseIdentityVerifier, OnModuleInit
{
  private readonly logger = new Logger(FirebaseIdentityService.name);
  private app?: App;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn('Firebase Authentication is disabled');
      return;
    }

    await this.getFirebaseApp();
    this.logger.log('Firebase Admin connected successfully');
  }

  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Đăng nhập bằng Firebase hiện chưa sẵn sàng.',
      );
    }

    try {
      const [{ getAuth }, app] = await Promise.all([
        import('firebase-admin/auth'),
        this.getFirebaseApp(),
      ]);
      const decodedToken = await getAuth(app).verifyIdToken(idToken, true);
      const signInProvider = decodedToken.firebase?.sign_in_provider;

      if (!this.isSupportedProvider(signInProvider)) {
        throw new UnauthorizedException(
          'Phương thức đăng nhập Firebase không được Lambe hỗ trợ.',
        );
      }

      return {
        uid: decodedToken.uid,
        signInProvider,
        phoneNumber: decodedToken.phone_number,
        email: decodedToken.email,
        displayName:
          typeof decodedToken.name === 'string' ? decodedToken.name : undefined,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;

      this.logger.warn('Firebase rejected an authentication token');
      throw new UnauthorizedException(
        'Phiên xác thực Firebase không hợp lệ hoặc đã hết hạn.',
      );
    }
  }

  private isSupportedProvider(
    provider: string | undefined,
  ): provider is SupportedFirebaseSignInProvider {
    return SUPPORTED_FIREBASE_SIGN_IN_PROVIDERS.some(
      (supportedProvider) => supportedProvider === provider,
    );
  }

  private isEnabled(): boolean {
    return this.configService.get<boolean>('firebase.enabled') === true;
  }

  private async getFirebaseApp(): Promise<App> {
    if (this.app) return this.app;

    const { applicationDefault, getApps, initializeApp } =
      await import('firebase-admin/app');
    const existingApp = getApps()[0];
    this.app =
      existingApp ||
      initializeApp({
        credential: applicationDefault(),
        projectId: this.configService.getOrThrow<string>('firebase.projectId'),
      });

    return this.app;
  }
}
