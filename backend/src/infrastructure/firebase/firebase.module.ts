import { Module } from '@nestjs/common';
import { FIREBASE_IDENTITY_VERIFIER } from '../../modules/auth/application/firebase-identity-verifier.port';
import { FirebaseIdentityService } from './firebase-identity.service';

@Module({
  providers: [
    FirebaseIdentityService,
    {
      provide: FIREBASE_IDENTITY_VERIFIER,
      useExisting: FirebaseIdentityService,
    },
  ],
  exports: [FIREBASE_IDENTITY_VERIFIER, FirebaseIdentityService],
})
export class FirebaseModule {}
