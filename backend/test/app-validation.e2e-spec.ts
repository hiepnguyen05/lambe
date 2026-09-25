import request from 'supertest';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('Application validation (e2e)', () => {
  let context: TestAppContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context?.app.close();
  });

  it('/api/health reports PostgreSQL and cache status', () => {
    return request(context.app.getHttpServer())
      .get('/api/health')
      .set('x-request-id', 'e2e-request-id')
      .expect(200)
      .expect('x-request-id', 'e2e-request-id')
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: {
            status: 'ok',
            services: { database: 'up', cache: 'disabled' },
          },
        });
      });
  });

  it('/api/auth/send-otp rejects an invalid phone number', () => {
    return request(context.app.getHttpServer())
      .post('/api/auth/send-otp')
      .send({ phone: '0|12345678' })
      .expect(400);
  });

  it('/api/auth/send-otp rejects fields outside the DTO', () => {
    return request(context.app.getHttpServer())
      .post('/api/auth/send-otp')
      .send({ phone: '0363668951', role: 'ADMIN' })
      .expect(400);
  });

  it('/api/auth/verify-otp rejects a malformed OTP', () => {
    return request(context.app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ phone: '0363668951', code: '12AB56' })
      .expect(400);
  });

  it('/api/auth/complete-registration rejects an empty name and token', () => {
    return request(context.app.getHttpServer())
      .post('/api/auth/complete-registration')
      .send({ registrationToken: '', fullName: ' ' })
      .expect(400);
  });

  it('/api/auth/me requires an access token', () => {
    return request(context.app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('/api/admin/auth/me requires an internal access token', () => {
    return request(context.app.getHttpServer())
      .get('/api/admin/auth/me')
      .expect(401);
  });

  it('/api/admin/upload/image requires an internal access token', () => {
    return request(context.app.getHttpServer())
      .post('/api/admin/upload/image')
      .expect(401);
  });

  it('/api/admin/auth/login validates credentials before database access', () => {
    return request(context.app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'ad', password: 'short' })
      .expect(400);
  });

  it('/api/admin/auth/login rejects fields outside the DTO', () => {
    return request(context.app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        username: 'admin',
        password: 'A-strong-admin-password-2026',
        roles: ['ADMIN'],
      })
      .expect(400);
  });

  it('/api/admin/auth/refresh requires the HttpOnly cookie', () => {
    return request(context.app.getHttpServer())
      .post('/api/admin/auth/refresh')
      .expect(401);
  });

  it('/api/admin/auth/logout is idempotent without a session', () => {
    return request(context.app.getHttpServer())
      .post('/api/admin/auth/logout')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body).toMatchObject({ success: true });
        expect(headers['set-cookie']).toBeDefined();
      });
  });
});
