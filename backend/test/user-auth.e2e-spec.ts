import request from 'supertest';
import { createTestApp, type TestAppContext } from './support/create-test-app';

interface CustomerAddressBody {
  id: string;
  isDefault: boolean;
  note?: string | null;
}

interface CustomerAddressResponseBody {
  data: CustomerAddressBody;
}

interface CustomerAddressListResponseBody {
  data: CustomerAddressBody[];
}

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
      const authorization = `Bearer ${registrationBody.data.accessToken}`;

      await request(context.app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', authorization)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            success: true,
            data: { user: { phone, fullName: 'E2E Customer' } },
          });
        });

      const homeResponse = await request(context.app.getHttpServer())
        .post('/api/me/addresses')
        .set('Authorization', authorization)
        .send({
          label: 'Nhà',
          addressLine: '12 Nguyễn Huệ, Quận 1, TP.HCM',
          latitude: 10.7731,
          longitude: 106.703,
          contactName: 'E2E Customer',
          contactPhone: phone,
          note: 'Gọi trước khi đến',
        })
        .expect(201);
      const home = (homeResponse.body as unknown as CustomerAddressResponseBody)
        .data;
      expect(home.isDefault).toBe(true);

      const officeResponse = await request(context.app.getHttpServer())
        .post('/api/me/addresses')
        .set('Authorization', authorization)
        .send({
          label: 'Công ty',
          addressLine: '1 Lê Duẩn, Quận 1, TP.HCM',
          latitude: 10.7801,
          longitude: 106.6994,
          isDefault: false,
        })
        .expect(201);
      const office = (
        officeResponse.body as unknown as CustomerAddressResponseBody
      ).data;
      expect(office.isDefault).toBe(false);

      await request(context.app.getHttpServer())
        .get('/api/me/addresses')
        .set('Authorization', authorization)
        .expect(200)
        .expect(({ body }) => {
          const response = body as unknown as CustomerAddressListResponseBody;
          expect(response.data).toHaveLength(2);
          expect(response.data[0]).toMatchObject({
            id: home.id,
            isDefault: true,
          });
        });

      await request(context.app.getHttpServer())
        .put(`/api/me/addresses/${office.id}/default`)
        .set('Authorization', authorization)
        .expect(200)
        .expect(({ body }) => {
          const response = body as unknown as CustomerAddressResponseBody;
          expect(response.data).toMatchObject({
            id: office.id,
            isDefault: true,
          });
        });

      await request(context.app.getHttpServer())
        .patch(`/api/me/addresses/${home.id}`)
        .set('Authorization', authorization)
        .send({ note: 'Địa chỉ đã cập nhật' })
        .expect(200)
        .expect(({ body }) => {
          const response = body as unknown as CustomerAddressResponseBody;
          expect(response.data).toMatchObject({
            id: home.id,
            note: 'Địa chỉ đã cập nhật',
            isDefault: false,
          });
        });

      await request(context.app.getHttpServer())
        .patch('/api/me/addresses/00000000-0000-4000-8000-000000000099')
        .set('Authorization', authorization)
        .send({ note: 'Không được phép sửa' })
        .expect(404);

      await request(context.app.getHttpServer())
        .delete(`/api/me/addresses/${office.id}`)
        .set('Authorization', authorization)
        .expect(200);

      await request(context.app.getHttpServer())
        .get('/api/me/addresses')
        .set('Authorization', authorization)
        .expect(200)
        .expect(({ body }) => {
          const response = body as unknown as CustomerAddressListResponseBody;
          expect(response.data).toEqual([
            expect.objectContaining({ id: home.id, isDefault: true }),
          ]);
        });
    } finally {
      await context.prisma.user.deleteMany({ where: { phone } });
    }
  });
});
