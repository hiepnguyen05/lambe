import request from 'supertest';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('User authentication (e2e)', () => {
  let context: TestAppContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context?.app.close();
  });

  it('requires a verified phone before exchanging a Google identity', async () => {
    context.setVerifiedIdentity({
      uid: 'firebase-google-e2e-user',
      signInProvider: 'google.com',
      email: 'customer@example.com',
      displayName: 'E2E Google Customer',
    });

    await request(context.app.getHttpServer())
      .post('/api/auth/firebase')
      .send({ idToken: 'x'.repeat(100) })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: {
            requiresPhoneVerification: true,
            provider: 'google.com',
            email: 'customer@example.com',
            suggestedFullName: 'E2E Google Customer',
          },
        });
      });
  });

  it('completes Firebase phone registration and authenticated profile flow', async () => {
    const phone = '0390000001';
    context.setVerifiedPhone('+84390000001');
    await context.prisma.user.deleteMany({ where: { phone } });

    try {
      const verificationResponse = await request(context.app.getHttpServer())
        .post('/api/auth/firebase')
        .send({ idToken: 'x'.repeat(100) })
        .expect(200);
      const verificationBody = verificationResponse.body as unknown as {
        data: { isNewUser: boolean; registrationToken: string };
      };
      expect(verificationBody.data.isNewUser).toBe(true);

      const registrationResponse = await request(context.app.getHttpServer())
        .post('/api/auth/complete-registration')
        .send({
          registrationToken: verificationBody.data.registrationToken,
          fullName: 'E2E Customer',
        })
        .expect(201);
      const registrationBody = registrationResponse.body as unknown as {
        data: { accessToken: string; user: { phone: string } };
      };
      expect(registrationBody.data.user.phone).toBe(phone);

      await request(context.app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registrationBody.data.accessToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            success: true,
            data: { user: { phone, fullName: 'E2E Customer' } },
          });
        });
    } finally {
      await context.prisma.user.deleteMany({ where: { phone } });
    }
  });
});
