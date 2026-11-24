import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ARGON2_OPTIONS } from '../src/modules/internal-auth/constants/password.constants';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('Internal operations (e2e)', () => {
  let context: TestAppContext;
  const marker = randomUUID().slice(0, 8);
  const adminUsername = `ops.admin.${marker}`;
  const staffUsername = `ops.staff.${marker}`;
  const staffEmail = `${staffUsername}@example.test`;
  const password = 'E2E-strong-admin-password-2026';
  const staffPassword = 'E2E-strong-staff-password-2026';

  beforeAll(async () => {
    context = await createTestApp();
  });
  afterAll(async () => {
    await context?.app.close();
  });

  it('invites, activates, authorizes and revokes internal accounts', async () => {
    const admin = await context.prisma.internalAccount.create({
      data: {
        username: adminUsername,
        normalizedUsername: adminUsername,
        fullName: 'Operations Admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        credential: {
          create: { passwordHash: await argon2.hash(password, ARGON2_OPTIONS) },
        },
        roles: { create: { role: 'ADMIN' } },
      },
    });
    let staffId: string | undefined;
    let mailId: string | undefined;
    try {
      const adminLogin = await request(context.app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username: adminUsername, password })
        .expect(200);
      const adminToken = (adminLogin.body as { data: { accessToken: string } })
        .data.accessToken;

      await request(context.app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(context.app.getHttpServer())
        .post(`/api/admin/internal-accounts/${admin.id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      const created = await request(context.app.getHttpServer())
        .post('/api/admin/internal-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: staffUsername,
          fullName: 'Operations Staff',
          email: staffEmail,
          roles: ['SUPPORT'],
        })
        .expect(201);
      staffId = (created.body as { data: { id: string } }).data.id;
      const mail = await context.prisma.mailOutbox.findFirst({
        where: { recipient: staffEmail },
        orderBy: { createdAt: 'desc' },
      });
      expect(mail).not.toBeNull();
      mailId = mail!.id;
      const token = mail!.text.match(
        /Ma thiet lap mat khau tai khoan noi bo Lambe: ([A-Za-z0-9_-]{64})/,
      )?.[1];
      expect(token).toBeTruthy();

      await request(context.app.getHttpServer())
        .post('/api/admin/auth/activate')
        .send({ token, password: staffPassword })
        .expect(200);
      await request(context.app.getHttpServer())
        .post('/api/admin/auth/activate')
        .send({ token, password: staffPassword })
        .expect(401);

      const staffLogin = await request(context.app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username: staffUsername, password: staffPassword })
        .expect(200);
      const staffToken = (staffLogin.body as { data: { accessToken: string } })
        .data.accessToken;
      await request(context.app.getHttpServer())
        .get('/api/admin/internal-accounts')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      await request(context.app.getHttpServer())
        .get(`/api/admin/orders/${randomUUID()}/evidence/${randomUUID()}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      await request(context.app.getHttpServer())
        .get('/api/admin/orders/operational-alerts')
        .expect(401);
      await request(context.app.getHttpServer())
        .get('/api/admin/orders/operational-alerts')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      for (const action of [
        'acknowledge',
        'resolve',
        'cancel-order',
        'escalate-dispute',
      ]) {
        await request(context.app.getHttpServer())
          .post(
            `/api/admin/orders/operational-alerts/${randomUUID()}/${action}`,
          )
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ resolutionNote: 'Kiểm thử quyền hỗ trợ' })
          .expect(404);
      }

      await request(context.app.getHttpServer())
        .put(`/api/admin/internal-accounts/${staffId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['MODERATOR'] })
        .expect(200);
      await request(context.app.getHttpServer())
        .get('/api/admin/auth/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(401);

      const audit = await request(context.app.getHttpServer())
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const auditRows = (audit.body as { data: Array<Record<string, unknown>> })
        .data;
      expect(auditRows.length).toBeGreaterThan(0);
      expect(auditRows[0]).not.toHaveProperty('metadata');
      expect(auditRows[0]).not.toHaveProperty('ipAddress');

      await request(context.app.getHttpServer())
        .post(`/api/admin/internal-accounts/${staffId}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    } finally {
      if (mailId)
        await context.prisma.mailOutbox.deleteMany({ where: { id: mailId } });
      await context.prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorInternalAccountId: admin.id },
            ...(staffId
              ? [{ actorInternalAccountId: staffId }, { resourceId: staffId }]
              : []),
          ],
        },
      });
      if (staffId)
        await context.prisma.internalAccount.deleteMany({
          where: { id: staffId },
        });
      await context.prisma.internalAccount.deleteMany({
        where: { id: admin.id },
      });
    }
  });
});
