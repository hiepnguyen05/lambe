import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';
import { PrismaService } from '../../src/infrastructure/persistence/postgres/prisma.service';
import { SMS_SENDER } from '../../src/infrastructure/sms/sms-sender';
import { MEDIA_STORAGE } from '../../src/modules/upload/application/media-storage.port';

export interface TestAppContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  smsSender: { sendOtp: jest.Mock<Promise<void>, [string, string]> };
  mediaStorage: {
    uploadImage: jest.Mock;
    deleteImage: jest.Mock;
  };
  getSentOtpCode(): string;
}

export async function createTestApp(): Promise<TestAppContext> {
  let sentOtpCode = '';
  const smsSender = {
    sendOtp: jest.fn((_phone: string, code: string) => {
      sentOtpCode = code;
      return Promise.resolve();
    }),
  };
  const mediaStorage = {
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
    .overrideProvider(SMS_SENDER)
    .useValue(smsSender)
    .overrideProvider(MEDIA_STORAGE)
    .useValue(mediaStorage)
    .compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();

  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    smsSender,
    mediaStorage,
    getSentOtpCode: () => sentOtpCode,
  };
}
