import * as argon2 from 'argon2';
import request from 'supertest';
import { ARGON2_OPTIONS } from '../src/modules/internal-auth/constants/password.constants';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('Admin authentication and categories (e2e)', () => {
  let context: TestAppContext;

  beforeAll(async () => {
    context = await createTestApp();
  });

  afterAll(async () => {
    await context?.app.close();
  });

  it('persists the request id for a rejected internal login', async () => {
    const requestId = 'e2e-rejected-login';

    try {
      await request(context.app.getHttpServer())
        .post('/api/admin/auth/login')
        .set('x-request-id', requestId)
        .send({
          username: 'unknown.internal',
          password: 'A-strong-admin-password-2026',
        })
        .expect(401)
        .expect('x-request-id', requestId);

      await expect(
        context.prisma.auditLog.findFirst({
          where: { requestId, action: 'INTERNAL_LOGIN' },
        }),
      ).resolves.toMatchObject({
        requestId,
        result: 'INVALID_CREDENTIALS',
      });
    } finally {
      await context.prisma.auditLog.deleteMany({ where: { requestId } });
    }
  });

  it('completes admin login, refresh, profile and logout flow', async () => {
    const username = 'e2e.admin';
    const normalizedUsername = username.toLowerCase();
    const password = 'E2E-strong-admin-password-2026';
    await context.prisma.internalAccount.deleteMany({
      where: { normalizedUsername },
    });
    const account = await context.prisma.internalAccount.create({
      data: {
        username,
        normalizedUsername,
        fullName: 'E2E Admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        credential: {
          create: {
            passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
          },
        },
        roles: { create: { role: 'ADMIN' } },
      },
    });

    try {
      const agent = request.agent(context.app.getHttpServer());
      const loginResponse = await agent
        .post('/api/admin/auth/login')
        .send({ username, password })
        .expect(200);
      const loginBody = loginResponse.body as unknown as {
        data: { accessToken: string; account: { id: string } };
      };
      expect(loginBody.data.account.id).toBe(account.id);

      await agent
        .get('/api/admin/auth/me')
        .set('Authorization', `Bearer ${loginBody.data.accessToken}`)
        .expect(200);

      const refreshResponse = await agent
        .post('/api/admin/auth/refresh')
        .expect(200);
      const refreshBody = refreshResponse.body as unknown as {
        data: { accessToken: string };
      };
      expect(refreshBody.data.accessToken).toBeTruthy();

      await agent.post('/api/admin/auth/logout').expect(200);
      await agent
        .get('/api/admin/auth/me')
        .set('Authorization', `Bearer ${refreshBody.data.accessToken}`)
        .expect(401);
    } finally {
      await context.prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorInternalAccountId: account.id },
            { resourceId: account.id },
          ],
        },
      });
      await context.prisma.internalAccount.delete({
        where: { id: account.id },
      });
    }
  });

  it('secures and completes the service category lifecycle', async () => {
    const adminUsername = 'e2e.category.admin';
    const moderatorUsername = 'e2e.category.moderator';
    const password = 'E2E-strong-category-password-2026';
    const categoryCode = 'E2E_HAIR';

    const staleCategory = await context.prisma.serviceCategory.findUnique({
      where: { code: categoryCode },
    });
    if (staleCategory) {
      await context.prisma.auditLog.deleteMany({
        where: { resourceId: staleCategory.id },
      });
      await context.prisma.serviceCategory.delete({
        where: { id: staleCategory.id },
      });
    }

    for (const normalizedUsername of [adminUsername, moderatorUsername]) {
      const staleAccount = await context.prisma.internalAccount.findUnique({
        where: { normalizedUsername },
      });
      if (staleAccount) {
        await context.prisma.auditLog.deleteMany({
          where: { actorInternalAccountId: staleAccount.id },
        });
        await context.prisma.internalAccount.delete({
          where: { id: staleAccount.id },
        });
      }
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    const admin = await context.prisma.internalAccount.create({
      data: {
        username: adminUsername,
        normalizedUsername: adminUsername,
        fullName: 'Category Admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        credential: { create: { passwordHash } },
        roles: { create: { role: 'ADMIN' } },
      },
    });
    const moderator = await context.prisma.internalAccount.create({
      data: {
        username: moderatorUsername,
        normalizedUsername: moderatorUsername,
        fullName: 'Category Moderator',
        status: 'ACTIVE',
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        credential: { create: { passwordHash } },
        roles: { create: { role: 'MODERATOR' } },
      },
    });
    let categoryId: string | undefined;

    try {
      const adminLogin = await request(context.app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username: adminUsername, password })
        .expect(200);
      const moderatorLogin = await request(context.app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username: moderatorUsername, password })
        .expect(200);
      const adminToken = (adminLogin.body as { data: { accessToken: string } })
        .data.accessToken;
      const moderatorToken = (
        moderatorLogin.body as { data: { accessToken: string } }
      ).data.accessToken;

      await request(context.app.getHttpServer())
        .post('/api/admin/categories')
        .send({ code: categoryCode, name: 'E2E Tóc', slug: 'e2e-hair' })
        .expect(401);

      await request(context.app.getHttpServer())
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ code: categoryCode, name: 'E2E Tóc', slug: 'e2e-hair' })
        .expect(403);

      const createResponse = await request(context.app.getHttpServer())
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: categoryCode,
          name: 'E2E Tóc',
          slug: 'e2e-hair',
          sortOrder: 10,
        })
        .expect(201);
      const created = createResponse.body as {
        data: { id: string; status: string; code: string };
      };
      categoryId = created.data.id;
      expect(created.data).toMatchObject({
        code: categoryCode,
        status: 'INACTIVE',
      });

      await request(context.app.getHttpServer())
        .patch(`/api/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'CHANGED_CODE' })
        .expect(400);

      await request(context.app.getHttpServer())
        .patch(`/api/admin/categories/${categoryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      await request(context.app.getHttpServer())
        .get('/api/categories')
        .expect(200)
        .expect(({ body }) => {
          const categories = (body as { data: Array<Record<string, unknown>> })
            .data;
          const category = categories.find((item) => item.id === categoryId);
          expect(category).toMatchObject({
            code: categoryCode,
            name: 'E2E Tóc',
          });
          expect(category).not.toHaveProperty('status');
          expect(category).not.toHaveProperty('normalizedName');
        });

      await request(context.app.getHttpServer())
        .patch('/api/admin/categories/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ id: categoryId, sortOrder: 1 }] })
        .expect(200);

      await request(context.app.getHttpServer())
        .patch(`/api/admin/categories/${categoryId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' })
        .expect(200);

      await request(context.app.getHttpServer())
        .get('/api/categories')
        .expect(200)
        .expect(({ body }) => {
          const categories = (body as { data: Array<Record<string, unknown>> })
            .data;
          expect(categories.some((item) => item.id === categoryId)).toBe(false);
        });

      await expect(
        context.prisma.auditLog.count({
          where: {
            actorInternalAccountId: admin.id,
            resourceType: 'ServiceCategory',
          },
        }),
      ).resolves.toBe(4);
    } finally {
      if (categoryId) {
        await context.prisma.auditLog.deleteMany({
          where: { resourceId: categoryId },
        });
        await context.prisma.serviceCategory.deleteMany({
          where: { id: categoryId },
        });
      }
      await context.prisma.auditLog.deleteMany({
        where: {
          actorInternalAccountId: { in: [admin.id, moderator.id] },
        },
      });
      await context.prisma.internalAccount.deleteMany({
        where: { id: { in: [admin.id, moderator.id] } },
      });
    }
  });
});
