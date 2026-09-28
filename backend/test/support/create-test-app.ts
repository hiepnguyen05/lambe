import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';
import { PrismaService } from '../../src/infrastructure/persistence/postgres/prisma.service';
import { FIREBASE_IDENTITY_VERIFIER } from '../../src/modules/auth/application/firebase-identity-verifier.port';
import { MEDIA_STORAGE } from '../../src/modules/upload/application/media-storage.port';
import { MailService } from '../../src/infrastructure/mail/mail.service';

interface TestFirebaseIdentity {
  uid: string;
  signInProvider: 'phone' | 'google.com' | 'facebook.com';
  phoneNumber?: string;
  email?: string;
  displayName?: string;
}

export interface TestAppContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  firebaseIdentityVerifier: { verifyIdToken: jest.Mock };
  mediaStorage: {
    uploadImage: jest.Mock;
    uploadPrivateImage: jest.Mock;
    createPrivateDownloadUrl: jest.Mock;
    deleteImage: jest.Mock;
  };
  setVerifiedPhone(phone: string): void;
  setVerifiedIdentity(identity: TestFirebaseIdentity): void;
}

export async function createTestApp(): Promise<TestAppContext> {
  let verifiedIdentity: TestFirebaseIdentity = {
    uid: 'firebase-e2e-user',
    signInProvider: 'phone',
    phoneNumber: '+84390000001',
  };
  const firebaseIdentityVerifier = {
    verifyIdToken: jest
      .fn()
      .mockImplementation(() => Promise.resolve(verifiedIdentity)),
  };
  const mediaStorage = {
    uploadPrivateImage: jest
      .fn()
      .mockImplementation((_buffer: Buffer, folder: string) =>
        Promise.resolve({
          secureUrl: 'https://example.test/private.webp',
          publicId: `${folder}/${Date.now()}`,
          format: 'webp',
          resourceType: 'image',
          deliveryType: 'authenticated',
        }),
      ),
    createPrivateDownloadUrl: jest
      .fn()
      .mockReturnValue('https://example.test/signed-private'),
    uploadImage: jest.fn().mockResolvedValue({
      url: 'http://example.test/category.webp',
      secureUrl: 'https://example.test/category.webp',
      publicId: 'lambe/categories/e2e/category-cover',
      format: 'webp',
      resourceType: 'image',
    }),
    deleteImage: jest.fn().mockResolvedValue(true),
  };
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(FIREBASE_IDENTITY_VERIFIER)
    .useValue(firebaseIdentityVerifier)
    .overrideProvider(MEDIA_STORAGE)
    .useValue(mediaStorage)
    .overrideProvider(MailService)
    .useValue({
      isEnabled: () => true,
      send: jest.fn().mockResolvedValue(undefined),
    })
    .compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();

  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    firebaseIdentityVerifier,
    mediaStorage,
    setVerifiedPhone: (phone: string) => {
      verifiedIdentity = {
        uid: 'firebase-e2e-user',
        signInProvider: 'phone',
        phoneNumber: phone,
      };
    },
    setVerifiedIdentity: (identity: TestFirebaseIdentity) => {
      verifiedIdentity = identity;
    },
  };
}
