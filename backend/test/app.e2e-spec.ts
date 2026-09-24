import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/auth/send-otp rejects an invalid phone number', () => {
    return request(app.getHttpServer())
      .post('/api/auth/send-otp')
      .send({ phone: '0|12345678' })
      .expect(400);
  });

  it('/api/auth/me requires an access token', () => {
    return request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
