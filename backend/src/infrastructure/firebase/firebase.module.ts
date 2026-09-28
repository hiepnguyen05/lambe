import { Module } from '@nestjs/common';
import { FIREBASE_IDENTITY_VERIFIER } from '../../modules/auth/application/firebase-identity-verifier.port';
import { FirebaseIdentityService } from './firebase-identity.service';

@Module({
  providers: [
    {
      provide: FIREBASE_IDENTITY_VERIFIER,
      useClass: FirebaseIdentityService,
    },
  ],
  exports: [FIREBASE_IDENTITY_VERIFIER],
})
export class FirebaseModule {}
