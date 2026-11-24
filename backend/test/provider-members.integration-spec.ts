import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { requireIsolatedTestDatabase } from './support/isolated-test-database';
import { TransformInterceptor } from '../src/common/http/interceptors/transform.interceptor';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { ProviderMembersService } from '../src/modules/provider-members/application/provider-members.service';
import { ProviderMemberAccessService } from '../src/modules/provider-members/application/provider-member-access.service';
import { ProviderMemberInvitationsService } from '../src/modules/provider-members/application/invitations/provider-member-invitations.service';
import { ProviderInvitationResponseService } from '../src/modules/provider-members/application/invitations/provider-invitation-response.service';
import { ProviderMembersController } from '../src/modules/provider-members/controllers/provider-members.controller';
import { ProviderMemberInvitationsController } from '../src/modules/provider-members/controllers/provider-member-invitations.controller';
import { ProviderInvitationResponseController } from '../src/modules/provider-members/controllers/provider-invitation-response.controller';
import {
  memberTestOrganization,
  memberTestUser,
} from './support/provider-members.fixture';

interface Invitation {
  id: string;
  token: string;
  expiresAt: string;
}
interface InviteResponse {
  data: Invitation;
}
interface MemberResponse {
  data: {
    member: {
      id: string;
      role: string;
      status: string;
      providerId: string;
      canProvideServices: boolean;
    };
  };
}

describe('organization members HTTP + PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const ownerPath = '/api/me/provider/member-invitations';
  const recipientPath = '/api/me/provider-invitations';

  beforeAll(async () => {
    requireIsolatedTestDatabase(process.env);
    const url = process.env.TEST_DATABASE_URL;
    prisma = new PrismaService({ datasources: { db: { url } } });
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'organization-integration-test-only' }),
      ],
      controllers: [
        ProviderMembersController,
        ProviderMemberInvitationsController,
        ProviderInvitationResponseController,
      ],
      providers: [
        { provide: PrismaService, useValue: prisma },
        AuditService,
        JwtAuthGuard,
        ProviderMemberAccessService,
        ProviderMembersService,
        ProviderMemberInvitationsService,
        ProviderInvitationResponseService,
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useLogger(['error']);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });
  const client = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const user = () => memberTestUser(prisma, jwt);
  const organization = (individual = false) =>
    memberTestOrganization(prisma, jwt, individual);
  async function invite(token: string, phone: string): Promise<Invitation> {
    const response = await client()
      .post(ownerPath)
      .set('Authorization', auth(token))
      .send({ phone })
      .expect(201);
    return (response.body as InviteResponse).data;
  }
  const accept = (
    token: string,
    invitation: Invitation,
    secret = invitation.token,
  ) =>
    client()
      .post(`${recipientPath}/${invitation.id}/accept`)
      .set('Authorization', auth(token))
      .send({ token: secret });

  it('requires a valid session and an active organization owner for management', async () => {
    const org = await organization();
    const customer = await user();
    const individual = await organization(true);
    await client().get('/api/me/provider/members').expect(401);
    await client()
      .get('/api/me/provider/members')
      .set('Authorization', auth(customer.token))
      .expect(403);
    await client()
      .get('/api/me/provider/members')
      .set('Authorization', auth(individual.owner.token))
      .expect(403);
    await client()
      .get('/api/me/provider/members')
      .set('Authorization', auth(org.owner.token))
      .expect(200);
    await prisma.providerProfile.update({
      where: { id: org.provider.id },
      data: { status: 'SUSPENDED' },
    });
    await client()
      .get(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .expect(403);
  });

  it('normalizes phones, does not expose account existence, and never lists token hashes/secrets', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(
      org.owner.token,
      `+84${target.phone.slice(1)}`,
    );
    expect(invitation.token).toMatch(/^[a-f0-9]{64}$/);
    const stored = await prisma.providerMemberInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(stored.phone).toBe(target.phone);
    expect(stored.tokenHash).not.toBe(invitation.token);
    const list = await client()
      .get(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .expect(200);
    expect(JSON.stringify(list.body)).not.toContain(invitation.token);
    expect(JSON.stringify(list.body)).not.toContain('tokenHash');
    const logs = await prisma.auditLog.findMany({
      where: { resourceId: invitation.id },
    });
    expect(JSON.stringify(logs)).not.toContain(invitation.token);
    expect(JSON.stringify(logs)).not.toContain(target.phone);
    // A phone without an account receives the same contract and creates no user.
    const notRegistered = '0380000000';
    const before = await prisma.user.count({ where: { phone: notRegistered } });
    const unknown = await invite(org.owner.token, notRegistered);
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(invitation).sort());
    expect(await prisma.user.count({ where: { phone: notRegistered } })).toBe(
      before,
    );
  });

  it('rejects role/status mass assignment, invalid phones, tokens, IDs and unbounded pagination', async () => {
    const org = await organization();
    await client()
      .post(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .send({ phone: '0912345678', role: 'OWNER' })
      .expect(400);
    await client()
      .post(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .send({ phone: 'abc' })
      .expect(400);
    await client()
      .get(`${ownerPath}?limit=999`)
      .set('Authorization', auth(org.owner.token))
      .expect(400);
    await client()
      .post(`${recipientPath}/bad-id/accept`)
      .set('Authorization', auth(org.owner.token))
      .send({ token: 'a'.repeat(64) })
      .expect(400);
  });

  it('requires the correct account phone and token, then creates only a pending worker without a personal wallet', async () => {
    const org = await organization();
    const target = await user();
    const other = await user();
    const invitation = await invite(org.owner.token, target.phone);
    await accept(other.token, invitation).expect(404);
    await accept(target.token, invitation, 'f'.repeat(64)).expect(404);
    const response = await accept(target.token, invitation).expect(200);
    const member = (response.body as MemberResponse).data.member;
    expect(member).toMatchObject({
      providerId: org.provider.id,
      role: 'WORKER',
      status: 'PENDING_VERIFICATION',
      canProvideServices: true,
    });
    expect(
      await prisma.providerProfile.findUnique({ where: { userId: target.id } }),
    ).toBeNull();
    expect(
      await prisma.providerWallet.count({
        where: { providerId: org.provider.id },
      }),
    ).toBe(1);
    await client()
      .get('/api/me/provider/members')
      .set('Authorization', auth(target.token))
      .expect(403);
    await client()
      .get(ownerPath)
      .set('Authorization', auth(target.token))
      .expect(403);
    for (const action of ['resend', 'revoke']) {
      await client()
        .post(`${ownerPath}/${invitation.id}/${action}`)
        .set('Authorization', auth(target.token))
        .expect(403);
    }
    await client()
      .post(ownerPath)
      .set('Authorization', auth(target.token))
      .send({ phone: other.phone })
      .expect(403);
    const mine = await client()
      .get('/api/me/provider/memberships')
      .set('Authorization', auth(target.token))
      .expect(200);
    expect(JSON.stringify(mine.body)).not.toMatch(
      /wallet|tokenHash|nationalId/,
    );
    await accept(target.token, invitation).expect(409);
  });

  it('lists only invitations sent to the authenticated phone', async () => {
    const org = await organization();
    const target = await user();
    const other = await user();
    const one = await invite(org.owner.token, target.phone);
    const two = await invite(org.owner.token, other.phone);
    const inbox = await client()
      .get(recipientPath)
      .set('Authorization', auth(target.token))
      .expect(200);
    expect(JSON.stringify(inbox.body)).toContain(one.id);
    expect(JSON.stringify(inbox.body)).not.toContain(two.id);
    expect(JSON.stringify(inbox.body)).not.toContain('tokenHash');
    expect(JSON.stringify(inbox.body)).not.toContain(one.token);
  });

  it('blocks cross-organization revoke/resend and revocation invalidates a secret', async () => {
    const first = await organization();
    const second = await organization();
    const target = await user();
    const invitation = await invite(first.owner.token, target.phone);
    for (const action of ['revoke', 'resend']) {
      await client()
        .post(`${ownerPath}/${invitation.id}/${action}`)
        .set('Authorization', auth(second.owner.token))
        .expect(404);
    }
    await client()
      .post(`${ownerPath}/${invitation.id}/revoke`)
      .set('Authorization', auth(first.owner.token))
      .expect(200);
    await accept(target.token, invitation).expect(409);
  });

  it('enforces resend cooldown and rotates the secret immediately', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    const resend = () =>
      client()
        .post(`${ownerPath}/${invitation.id}/resend`)
        .set('Authorization', auth(org.owner.token));
    await resend().expect(409);
    await prisma.providerMemberInvitation.update({
      where: { id: invitation.id },
      data: { lastSentAt: new Date(Date.now() - 61_000) },
    });
    const response = await resend().expect(200);
    const updated = (response.body as InviteResponse).data;
    expect(updated.token).not.toBe(invitation.token);
    await accept(target.token, invitation).expect(404);
    await accept(target.token, updated).expect(200);
  });

  it('rejects expired and declined invitations without creating membership', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    await prisma.providerMemberInvitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await accept(target.token, invitation).expect(409);
    const list = await client()
      .get(recipientPath)
      .set('Authorization', auth(target.token))
      .expect(200);
    expect(JSON.stringify(list.body)).toContain('EXPIRED');
    const replacement = await invite(org.owner.token, target.phone);
    await client()
      .post(`${recipientPath}/${replacement.id}/decline`)
      .set('Authorization', auth(target.token))
      .send({ token: replacement.token })
      .expect(200);
    await accept(target.token, replacement).expect(409);
    expect(
      await prisma.providerMember.count({ where: { userId: target.id } }),
    ).toBe(0);
  });

  it('serializes simultaneous create requests for the same organization/phone', async () => {
    const org = await organization();
    const target = await user();
    const send = () =>
      client()
        .post(ownerPath)
        .set('Authorization', auth(org.owner.token))
        .send({ phone: target.phone });
    const results = await Promise.all([send(), send()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.providerMemberInvitation.count({
        where: {
          providerId: org.provider.id,
          phone: target.phone,
          status: 'PENDING',
        },
      }),
    ).toBe(1);
  });

  it('serializes double acceptance and creates one membership and one audit event', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    const results = await Promise.all([
      accept(target.token, invitation),
      accept(target.token, invitation),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.providerMember.count({ where: { userId: target.id } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          resourceId: invitation.id,
          action: 'PROVIDER_MEMBER_INVITATION_ACCEPTED',
        },
      }),
    ).toBe(1);
  });

  it('serializes acceptance of invitations from two different organizations for one worker', async () => {
    const first = await organization();
    const second = await organization();
    const target = await user();
    const one = await invite(first.owner.token, target.phone);
    const two = await invite(second.owner.token, target.phone);
    const results = await Promise.all([
      accept(target.token, one),
      accept(target.token, two),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.providerMember.count({
        where: { userId: target.id, status: { not: 'LEFT' } },
      }),
    ).toBe(1);
  });

  it('enforces the serving-membership invariant in PostgreSQL even without the API', async () => {
    const first = await organization();
    const second = await organization();
    const target = await user();
    await prisma.providerMember.create({
      data: {
        providerId: first.provider.id,
        userId: target.id,
        role: 'WORKER',
        canProvideServices: true,
      },
    });
    await expect(
      prisma.providerMember.create({
        data: {
          providerId: second.provider.id,
          userId: target.id,
          role: 'WORKER',
          status: 'ACTIVE',
          canProvideServices: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('blocks joining while the user owns an individual provider or an unfinished application', async () => {
    const org = await organization();
    const individual = await organization(true);
    const first = await invite(org.owner.token, individual.owner.phone);
    await accept(individual.owner.token, first).expect(409);
    const applicant = await user();
    await prisma.providerApplication.create({
      data: { userId: applicant.id, providerType: 'INDIVIDUAL' },
    });
    const second = await invite(org.owner.token, applicant.phone);
    await accept(applicant.token, second).expect(409);
  });

  it('does not allow acceptance after the organization is suspended', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    await prisma.providerProfile.update({
      where: { id: org.provider.id },
      data: { status: 'SUSPENDED' },
    });
    await accept(target.token, invitation).expect(409);
  });

  it('keeps owner membership and allows a pending worker to leave without deleting history', async () => {
    const org = await organization();
    const ownerMember = await prisma.providerMember.findUniqueOrThrow({
      where: {
        providerId_userId: {
          providerId: org.provider.id,
          userId: org.owner.id,
        },
      },
    });
    await client()
      .post(`/api/me/provider/memberships/${ownerMember.id}/leave`)
      .set('Authorization', auth(org.owner.token))
      .expect(403);
    const target = await user();
    const stranger = await user();
    const invitation = await invite(org.owner.token, target.phone);
    const accepted = await accept(target.token, invitation).expect(200);
    const memberId = (accepted.body as MemberResponse).data.member.id;
    const path = `/api/me/provider/memberships/${memberId}/leave`;
    await client()
      .post(path)
      .set('Authorization', auth(stranger.token))
      .expect(404);
    await client()
      .post(path)
      .set('Authorization', auth(target.token))
      .expect(200);
    expect(
      await prisma.providerMember.findUniqueOrThrow({
        where: { id: memberId },
      }),
    ).toMatchObject({ status: 'LEFT', leftAt: expect.any(Date) as Date });
    await client()
      .post(path)
      .set('Authorization', auth(target.token))
      .expect(200);
    const next = await invite(org.owner.token, target.phone);
    const rejoined = await accept(target.token, next).expect(200);
    expect((rejoined.body as MemberResponse).data.member.id).toBe(memberId);
    expect(
      await prisma.providerMember.findUniqueOrThrow({
        where: { id: memberId },
      }),
    ).toMatchObject({ status: 'PENDING_VERIFICATION', leftAt: null });
  });

  it('rolls back membership, role and invitation status if the audit insert fails', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    const audit = app.get(AuditService);
    const spy = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Simulated audit write failure'));
    const result = await accept(target.token, invitation);
    spy.mockRestore();
    expect(result.status).toBe(500);
    expect(
      await prisma.providerMember.count({ where: { userId: target.id } }),
    ).toBe(0);
    expect(
      await prisma.userRoleAssignment.count({
        where: { userId: target.id, role: 'PROVIDER' },
      }),
    ).toBe(0);
    expect(
      await prisma.providerMemberInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('returns no unrelated record for a valid UUID belonging to another user', async () => {
    const actor = await user();
    await client()
      .post(`/api/me/provider/memberships/${randomUUID()}/leave`)
      .set('Authorization', auth(actor.token))
      .expect(404);
  });

  it('blocks self-invitation and management by a suspended owner membership', async () => {
    const org = await organization();
    await client()
      .post(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .send({ phone: org.owner.phone })
      .expect(400);
    await prisma.providerMember.update({
      where: {
        providerId_userId: {
          providerId: org.provider.id,
          userId: org.owner.id,
        },
      },
      data: { status: 'SUSPENDED' },
    });
    await client()
      .get(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .expect(403);
  });

  it('limits pending invitations and allows reusing quota after revocation', async () => {
    const org = await organization();
    const target = await user();
    await prisma.providerMemberInvitation.createMany({
      data: Array.from({ length: 50 }, (_, index) => ({
        providerId: org.provider.id,
        invitedByUserId: org.owner.id,
        phone: `037${index.toString().padStart(7, '0')}`,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    });
    await client()
      .post(ownerPath)
      .set('Authorization', auth(org.owner.token))
      .send({ phone: target.phone })
      .expect(409);
    const existing = await prisma.providerMemberInvitation.findFirstOrThrow({
      where: { providerId: org.provider.id },
    });
    await client()
      .post(`${ownerPath}/${existing.id}/revoke`)
      .set('Authorization', auth(org.owner.token))
      .expect(200);
    await invite(org.owner.token, target.phone);
  });

  it('resolves an accept/revoke race to one final decision', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    const results = await Promise.all([
      accept(target.token, invitation),
      client()
        .post(`${ownerPath}/${invitation.id}/revoke`)
        .set('Authorization', auth(org.owner.token)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const stored = await prisma.providerMemberInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(['ACCEPTED', 'REVOKED']).toContain(stored.status);
    expect(
      await prisma.providerMember.count({ where: { userId: target.id } }),
    ).toBe(stored.status === 'ACCEPTED' ? 1 : 0);
  });

  it('requires support for leaving ACTIVE/SUSPENDED membership and rejects blocked accounts', async () => {
    const org = await organization();
    const target = await user();
    const invitation = await invite(org.owner.token, target.phone);
    const response = await accept(target.token, invitation).expect(200);
    const memberId = (response.body as MemberResponse).data.member.id;
    for (const status of ['ACTIVE', 'SUSPENDED'] as const) {
      await prisma.providerMember.update({
        where: { id: memberId },
        data: { status },
      });
      await client()
        .post(`/api/me/provider/memberships/${memberId}/leave`)
        .set('Authorization', auth(target.token))
        .expect(409);
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { status: 'BLOCKED' },
    });
    await client()
      .get('/api/me/provider/memberships')
      .set('Authorization', auth(target.token))
      .expect(401);
  });
});
