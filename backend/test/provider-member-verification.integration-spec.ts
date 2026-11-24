import { ProviderDocumentType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createMemberVerificationTestApp } from './support/member-verification-test-app';
import {
  memberTestOrder,
  memberTestReviewer,
  memberVerificationFixture,
} from './support/member-verification.fixture';
import {
  memberTestOrganization,
  memberTestUser,
} from './support/provider-members.fixture';

interface Verification {
  id: string;
  revisionNumber: number;
  status: string;
  documents: { id: string; type: string; status: string }[];
}
interface VerificationResponse {
  data: Verification;
}
interface DocumentResponse {
  data: { id: string; type: string; status: string };
}
type Fixture = Awaited<ReturnType<typeof memberVerificationFixture>>;

describe('member KYC and lifecycle HTTP + PostgreSQL', () => {
  let c: Awaited<ReturnType<typeof createMemberVerificationTestApp>>;
  let moderator: Awaited<ReturnType<typeof memberTestReviewer>>;
  let support: Awaited<ReturnType<typeof memberTestReviewer>>;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOQAAAABJRU5ErkJggg==',
    'base64',
  );
  const path = (f: Fixture) =>
    `/api/me/provider/memberships/${f.member.id}/verification`;
  const admin = (f: Fixture) =>
    `/api/admin/provider-members/${f.member.id}/verification`;
  const auth = (token: string) => `Bearer ${token}`;
  const client = () => request(c.app.getHttpServer());
  const fixture = () => memberVerificationFixture(c.prisma, c.jwt);

  beforeAll(async () => {
    c = await createMemberVerificationTestApp();
    moderator = await memberTestReviewer(c.prisma, c.jwt, 'MODERATOR');
    support = await memberTestReviewer(c.prisma, c.jwt, 'SUPPORT');
  });
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  const save = (
    f: Fixture,
    body: Record<string, unknown> = f.body,
    token = f.worker.token,
  ) => client().put(path(f)).set('Authorization', auth(token)).send(body);
  const read = (f: Fixture) =>
    client().get(path(f)).set('Authorization', auth(f.worker.token));
  async function upload(
    f: Fixture,
    type: ProviderDocumentType,
    extra: Record<string, string> = {},
  ) {
    const response = await client()
      .post(`${path(f)}/documents`)
      .set('Authorization', auth(f.worker.token))
      .query({
        type,
        ...(['PROFESSIONAL_CERTIFICATE', 'PORTFOLIO'].includes(type)
          ? { providerServiceId: f.offering.id }
          : {}),
        ...extra,
      })
      .attach('file', png, {
        filename: 'evidence.png',
        contentType: 'image/png',
      })
      .expect(201);
    return (response.body as DocumentResponse).data;
  }
  async function ready(f: Fixture) {
    await save(f).expect(200);
    for (const type of [
      'PORTRAIT',
      'ID_CARD_FRONT',
      'ID_CARD_BACK',
      'IDENTITY_SELFIE',
      'PROFESSIONAL_CERTIFICATE',
      'PORTFOLIO',
    ] as const)
      await upload(f, type);
    const response = await client()
      .post(`${path(f)}/submit`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    return (response.body as VerificationResponse).data;
  }
  const revision = (profile: Verification) => ({
    verificationId: profile.id,
    revisionNumber: profile.revisionNumber,
  });
  async function verifyAll(
    f: Fixture,
    profile: Verification,
    token = moderator.token,
  ) {
    for (const doc of profile.documents)
      await client()
        .patch(`${admin(f)}/documents/${doc.id}`)
        .set('Authorization', auth(token))
        .send({ ...revision(profile), status: 'VERIFIED' })
        .expect(200);
  }
  const approve = (f: Fixture, p: Verification, token = moderator.token) =>
    client()
      .post(`${admin(f)}/approve`)
      .set('Authorization', auth(token))
      .send(revision(p));
  async function approved(f: Fixture) {
    const p = await ready(f);
    await verifyAll(f, p);
    await approve(f, p).expect(200);
    return p;
  }

  it('encrypts national ID, masks responses, and keeps shared identity claims exclusive', async () => {
    const f = await fixture();
    const response = await save(f).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(
      f.body.nationalIdNumber,
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /nationalIdEncrypted|nationalIdHash/,
    );
    const p = await c.prisma.providerMemberVerification.findFirstOrThrow({
      where: { memberId: f.member.id },
    });
    expect(p.nationalIdEncrypted).not.toBe(f.body.nationalIdNumber);
    expect(c.crypto.revealNationalId(p.nationalIdEncrypted!)).toBe(
      f.body.nationalIdNumber,
    );
    const other = await fixture();
    await save(other, {
      ...other.body,
      nationalIdNumber: f.body.nationalIdNumber,
    }).expect(409);
    expect((response.body as VerificationResponse).data.status).toBe('DRAFT');
  });

  it('rejects invalid dates, minors, incomplete consent, mass assignment, wrong organization service and missing documents', async () => {
    const f = await fixture();
    for (const patch of [
      { birthDate: '1995-02-30' },
      { birthDate: '2020-01-01' },
      { acceptedTerms: false },
      { status: 'APPROVED' },
      { requestedProviderServiceIds: [randomUUID()] },
    ])
      await save(f, { ...f.body, ...patch }).expect(400);
    await save(f).expect(200);
    await client()
      .post(`${path(f)}/submit`)
      .set('Authorization', auth(f.worker.token))
      .expect(400);
  });

  it('prevents owner/other worker from reading or updating private KYC and blocks user tokens on internal routes', async () => {
    const f = await fixture();
    const other = await memberTestUser(c.prisma, c.jwt);
    await save(f).expect(200);
    for (const token of [f.owner.token, other.token]) {
      await client().get(path(f)).set('Authorization', auth(token)).expect(404);
      await save(f, f.body, token).expect(404);
    }
    await client()
      .get(admin(f))
      .set('Authorization', auth(f.owner.token))
      .expect(401);
    await client().get(path(f)).expect(401);
  });

  it('uses private raster-only uploads, binds certificates to services and never exposes storage IDs', async () => {
    const f = await fixture();
    await save(f).expect(200);
    const calls = c.media.uploadPrivateImage.mock.calls.length;
    await client()
      .post(`${path(f)}/documents?type=ID_CARD_FRONT`)
      .set('Authorization', auth(f.worker.token))
      .attach(
        'file',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        { filename: 'id.svg', contentType: 'image/svg+xml' },
      )
      .expect(400);
    expect(c.media.uploadPrivateImage.mock.calls.length).toBe(calls);
    await client()
      .post(`${path(f)}/documents?type=PROFESSIONAL_CERTIFICATE`)
      .set('Authorization', auth(f.worker.token))
      .attach('file', png, 'cert.png')
      .expect(400);
    const doc = await upload(f, 'ID_CARD_FRONT');
    expect(JSON.stringify(doc)).not.toMatch(/publicId|secureUrl|deliveryType/);
    const stored = await c.prisma.providerMemberDocument.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(stored.deliveryType).toBe('authenticated');
    expect(Object.keys(stored)).not.toContain('fileUrl');
    await client()
      .get(`${path(f)}/documents/${doc.id}/access`)
      .set('Authorization', auth(f.owner.token))
      .expect(404);
    const access = await client()
      .get(`${path(f)}/documents/${doc.id}/access`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    expect(access.headers['cache-control']).toBe('no-store');
  });

  it('does not persist public uploads and compensates for a storage/database mismatch', async () => {
    const f = await fixture();
    await save(f).expect(200);
    const publicId = `test/public-mismatch/${randomUUID()}`;
    c.media.uploadPrivateImage.mockResolvedValueOnce({
      publicId,
      secureUrl: 'https://example.test/public',
      format: 'png',
      deliveryType: 'upload',
    });
    await client()
      .post(`${path(f)}/documents?type=ID_CARD_FRONT`)
      .set('Authorization', auth(f.worker.token))
      .attach('file', png, 'id.png')
      .expect(409);
    expect(c.media.deleteImage).toHaveBeenCalledWith(publicId, 'upload');
    expect(
      await c.prisma.providerMemberDocument.count({
        where: { verification: { memberId: f.member.id } },
      }),
    ).toBe(0);
  });

  it('allows moderators to verify each document and approve directly without exposing KYC to support', async () => {
    const f = await fixture();
    const p = await ready(f);
    await client()
      .get(admin(f))
      .set('Authorization', auth(support.token))
      .expect(403);
    await approve(f, p, support.token).expect(403);
    await approve(f, p).expect(400);
    await verifyAll(f, p);
    await approve(f, p).expect(200);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({ status: 'ACTIVE', canProvideServices: true });
    expect(
      await c.prisma.providerProfile.count({ where: { userId: f.worker.id } }),
    ).toBe(0);
    expect(
      await c.prisma.providerWallet.count({
        where: { providerId: f.provider.id },
      }),
    ).toBe(1);
    await save(f).expect(409);
    await approve(f, p).expect(409);
  });

  it('requires a reason and explicit access to reveal identity, with audit and no-store', async () => {
    const f = await fixture();
    const saved = await save(f).expect(200);
    const verificationId = (saved.body as VerificationResponse).data.id;
    await client()
      .post(`${admin(f)}/identity/access`)
      .set('Authorization', auth(moderator.token))
      .send({ verificationId })
      .expect(400);
    await client()
      .post(`${admin(f)}/identity/access`)
      .set('Authorization', auth(support.token))
      .send({ verificationId, reason: 'Đối chiếu CCCD' })
      .expect(403);
    const response = await client()
      .post(`${admin(f)}/identity/access`)
      .set('Authorization', auth(moderator.token))
      .send({ verificationId, reason: 'Đối chiếu CCCD' })
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(
      (response.body as { data: { nationalIdNumber: string } }).data
        .nationalIdNumber,
    ).toBe(f.body.nationalIdNumber);
    const logs = await c.prisma.auditLog.findMany({
      where: { resourceId: verificationId },
    });
    expect(
      logs.some((l) => l.action === 'PROVIDER_MEMBER_IDENTITY_ACCESSED'),
    ).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(f.body.nationalIdNumber);
  });

  it('requires exact verification ID/revision and rejects expired certificates and inactive catalog at approval', async () => {
    const f = await fixture();
    const p = await ready(f);
    await verifyAll(f, p);
    await approve(f, { ...p, id: randomUUID() }).expect(409);
    await approve(f, { ...p, revisionNumber: p.revisionNumber + 1 }).expect(
      409,
    );
    const cert = p.documents.find(
      (d) => d.type === 'PROFESSIONAL_CERTIFICATE',
    )!;
    await c.prisma.providerMemberDocument.update({
      where: { id: cert.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await approve(f, p).expect(400);
    await c.prisma.providerMemberDocument.update({
      where: { id: cert.id },
      data: { expiresAt: null },
    });
    await c.prisma.service.update({
      where: { id: f.catalog.id },
      data: { status: 'INACTIVE' },
    });
    await approve(f, p).expect(400);
  });

  it('supports correcting one blurred certificate while preserving verified identity evidence', async () => {
    const f = await fixture();
    const p = await ready(f);
    await verifyAll(f, p);
    const cert = p.documents.find(
      (d) => d.type === 'PROFESSIONAL_CERTIFICATE',
    )!;
    await client()
      .patch(`${admin(f)}/documents/${cert.id}`)
      .set('Authorization', auth(moderator.token))
      .send({
        ...revision(p),
        status: 'NEEDS_CHANGES',
        reviewNote: 'Ảnh chứng chỉ bị mờ.',
      })
      .expect(200);
    await client()
      .post(`${admin(f)}/request-changes`)
      .set('Authorization', auth(moderator.token))
      .send({ ...revision(p), reason: 'Vui lòng chụp rõ chứng chỉ.' })
      .expect(200);
    const front = p.documents.find((d) => d.type === 'ID_CARD_FRONT')!;
    await client()
      .delete(`${path(f)}/documents/${front.id}`)
      .set('Authorization', auth(f.worker.token))
      .expect(409);
    const replacement = await upload(f, 'PROFESSIONAL_CERTIFICATE', {
      replacesDocumentId: cert.id,
    });
    expect(
      await c.prisma.providerMemberDocument.findUniqueOrThrow({
        where: { id: cert.id },
      }),
    ).toMatchObject({ supersededAt: expect.any(Date) as Date });
    const submitted = await client()
      .post(`${path(f)}/submit`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    const p2 = (submitted.body as VerificationResponse).data;
    expect(p2.revisionNumber).toBe(2);
    expect(p2.documents.find((d) => d.id === front.id)?.status).toBe(
      'VERIFIED',
    );
    await approve(f, p).expect(409);
    await client()
      .patch(`${admin(f)}/documents/${replacement.id}`)
      .set('Authorization', auth(moderator.token))
      .send({ ...revision(p2), status: 'VERIFIED' })
      .expect(200);
    await approve(f, p2).expect(200);
    expect(
      await c.prisma.providerMemberVerificationRevision.count({
        where: { verificationId: p.id },
      }),
    ).toBe(2);
  });

  it('serializes concurrent approval and blocks approval while the member is suspended', async () => {
    const f = await fixture();
    const p = await ready(f);
    await verifyAll(f, p);
    await client()
      .post(`/api/me/provider/members/${f.member.id}/suspend`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Cần kiểm tra hồ sơ.' })
      .expect(200);
    await approve(f, p).expect(403);
    await client()
      .post(`/api/me/provider/members/${f.member.id}/reactivate`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Tiếp tục xét duyệt hồ sơ.' })
      .expect(200);
    const results = await Promise.all([approve(f, p), approve(f, p)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('keeps internal suspensions outside owner control and revalidates certificates before restoring ACTIVE', async () => {
    const f = await fixture();
    const p = await approved(f);
    await client()
      .post(`/api/admin/provider-members/${f.member.id}/suspend`)
      .set('Authorization', auth(support.token))
      .send({ reason: 'Đang xác minh phản ánh.' })
      .expect(200);
    await client()
      .post(`/api/me/provider/members/${f.member.id}/reactivate`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Tổ chức đề nghị khôi phục.' })
      .expect(403);
    const cert = p.documents.find(
      (d) => d.type === 'PROFESSIONAL_CERTIFICATE',
    )!;
    await c.prisma.providerMemberDocument.update({
      where: { id: cert.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await client()
      .post(`/api/admin/provider-members/${f.member.id}/reactivate`)
      .set('Authorization', auth(support.token))
      .send({ reason: 'Đã kiểm tra phản ánh.' })
      .expect(400);
    await c.prisma.providerMemberDocument.update({
      where: { id: cert.id },
      data: { expiresAt: null },
    });
    await client()
      .post(`/api/admin/provider-members/${f.member.id}/reactivate`)
      .set('Authorization', auth(support.token))
      .send({ reason: 'Đã kiểm tra phản ánh.' })
      .expect(200);
  });

  it('blocks cross-organization lifecycle actions and protects the owner', async () => {
    const f = await fixture();
    const other = await memberTestOrganization(c.prisma, c.jwt);
    await client()
      .post(`/api/me/provider/members/${f.member.id}/suspend`)
      .set('Authorization', auth(other.owner.token))
      .send({ reason: 'Không có quyền này.' })
      .expect(404);
    const owner = await c.prisma.providerMember.findUniqueOrThrow({
      where: {
        providerId_userId: { providerId: f.provider.id, userId: f.owner.id },
      },
    });
    await client()
      .post(`/api/me/provider/members/${owner.id}/suspend`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Tự khóa người sở hữu.' })
      .expect(403);
  });

  it('preserves membership version history and refuses stale review after leave/rejoin', async () => {
    const f = await fixture();
    const old = await ready(f);
    await client()
      .post(`/api/me/provider/memberships/${f.member.id}/leave`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    const invitation = await client()
      .post('/api/me/provider/member-invitations')
      .set('Authorization', auth(f.owner.token))
      .send({ phone: f.worker.phone })
      .expect(201);
    const invite = (invitation.body as { data: { id: string; token: string } })
      .data;
    await client()
      .post(`/api/me/provider-invitations/${invite.id}/accept`)
      .set('Authorization', auth(f.worker.token))
      .send({ token: invite.token })
      .expect(200);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({ membershipVersion: 2, status: 'PENDING_VERIFICATION' });
    const current = await read(f).expect(200);
    expect((current.body as { data: unknown }).data).toBeNull();
    const next = await ready(f);
    expect(next.id).not.toBe(old.id);
    expect(next.revisionNumber).toBe(old.revisionNumber);
    await verifyAll(f, next);
    await approve(f, old).expect(409);
    await approve(f, next).expect(200);
  });

  it('blocks ACTIVE exit while orders, calendars or wallet holds are unresolved', async () => {
    const f = await fixture();
    await approved(f);
    const order = await memberTestOrder(c.prisma, f);
    const leave = () =>
      client()
        .post(`/api/me/provider/memberships/${f.member.id}/leave`)
        .set('Authorization', auth(f.worker.token));
    await leave().expect(409);
    await c.prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: 'COMPLETED' },
    });
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    const hold = await c.prisma.walletHold.create({
      data: { walletId: wallet.id, orderId: order.id, amount: 30_000 },
    });
    await leave().expect(409);
    await c.prisma.walletHold.update({
      where: { id: hold.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    const calendar = await c.prisma.providerCalendarBlock.create({
      data: {
        providerId: f.provider.id,
        startAt: new Date(Date.now() + 86_400_000),
        endAt: new Date(Date.now() + 90_000_000),
      },
    });
    await leave().expect(409);
    await c.prisma.providerCalendarBlock.update({
      where: { id: calendar.id },
      data: { active: false },
    });
    const safety = await c.prisma.orderSafetyIncident.create({
      data: { orderId: order.id },
    });
    await leave().expect(409);
    await c.prisma.orderSafetyIncident.update({
      where: { id: safety.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    const cancellation = await c.prisma.orderCancellationRequest.create({
      data: {
        orderId: order.id,
        reason: 'TRANSPORT_ISSUE',
        detail: 'Yêu cầu hỗ trợ đang xử lý.',
        status: 'SUPPORT_REVIEW',
      },
    });
    await leave().expect(409);
    await c.prisma.orderCancellationRequest.update({
      where: { id: cancellation.id },
      data: { status: 'DENIED', decidedAt: new Date() },
    });
    await leave().expect(200);
  });

  it('reopens only selected evidence for renewal, removes execution eligibility and requires reapproval', async () => {
    const f = await fixture();
    const p = await approved(f);
    const cert = p.documents.find(
      (d) => d.type === 'PROFESSIONAL_CERTIFICATE',
    )!;
    await client()
      .post(`${path(f)}/reopen`)
      .set('Authorization', auth(f.worker.token))
      .send({ documentIds: [cert.id], reason: 'Cập nhật chứng chỉ mới.' })
      .expect(200);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({ status: 'PENDING_VERIFICATION' });
    const identity = p.documents.find((d) => d.type === 'ID_CARD_FRONT')!;
    expect(
      await c.prisma.providerMemberDocument.findUniqueOrThrow({
        where: { id: identity.id },
      }),
    ).toMatchObject({ status: 'VERIFIED' });
    const replacement = await upload(f, 'PROFESSIONAL_CERTIFICATE', {
      replacesDocumentId: cert.id,
      expiresAt: '2030-12-31T00:00:00Z',
    });
    const submitted = await client()
      .post(`${path(f)}/submit`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    const p2 = (submitted.body as VerificationResponse).data;
    await client()
      .patch(`${admin(f)}/documents/${replacement.id}`)
      .set('Authorization', auth(moderator.token))
      .send({ ...revision(p2), status: 'VERIFIED' })
      .expect(200);
    await approve(f, p2).expect(200);
  });

  it('rolls back activation and verification when audit persistence fails', async () => {
    const f = await fixture();
    const p = await ready(f);
    await verifyAll(f, p);
    const spy = jest
      .spyOn(c.audit, 'record')
      .mockRejectedValueOnce(new Error('Simulated audit failure'));
    await approve(f, p).expect(500);
    spy.mockRestore();
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({ status: 'PENDING_VERIFICATION' });
    expect(
      await c.prisma.providerMemberVerification.findUniqueOrThrow({
        where: { id: p.id },
      }),
    ).toMatchObject({ status: 'PENDING_REVIEW' });
  });

  it.each(['ADMIN', 'KYC_REVIEWER'] as const)(
    'allows %s to approve through the same KYC checks',
    async (role) => {
      const f = await fixture();
      const actor = await memberTestReviewer(c.prisma, c.jwt, role);
      const p = await ready(f);
      await verifyAll(f, p, actor.token);
      await approve(f, p, actor.token).expect(200);
    },
  );

  it('keeps a managing owner active while verifying their own service-execution eligibility', async () => {
    const f = await fixture();
    const ownerMember = await c.prisma.providerMember.findUniqueOrThrow({
      where: {
        providerId_userId: { providerId: f.provider.id, userId: f.owner.id },
      },
    });
    const own: Fixture = { ...f, worker: f.owner, member: ownerMember };
    const p = await ready(own);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: ownerMember.id },
      }),
    ).toMatchObject({
      role: 'OWNER',
      status: 'ACTIVE',
      canProvideServices: false,
    });
    await verifyAll(own, p);
    await approve(own, p).expect(200);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: ownerMember.id },
      }),
    ).toMatchObject({
      role: 'OWNER',
      status: 'ACTIVE',
      canProvideServices: true,
    });
  });

  it('records rejection with a reason and prevents further edits or activation of that verification', async () => {
    const f = await fixture();
    const p = await ready(f);
    await client()
      .post(`${admin(f)}/reject`)
      .set('Authorization', auth(moderator.token))
      .send(revision(p))
      .expect(400);
    await client()
      .post(`${admin(f)}/reject`)
      .set('Authorization', auth(moderator.token))
      .send({ ...revision(p), reason: 'Giấy tờ không đối chiếu được.' })
      .expect(200);
    await save(f).expect(409);
    await approve(f, p).expect(409);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({ status: 'PENDING_VERIFICATION' });
  });

  it('invalidates verified identity documents when legal identity is corrected', async () => {
    const f = await fixture();
    const p = await ready(f);
    await verifyAll(f, p);
    await client()
      .post(`${admin(f)}/request-changes`)
      .set('Authorization', auth(moderator.token))
      .send({ ...revision(p), reason: 'Sửa họ tên khớp giấy tờ.' })
      .expect(200);
    await save(f, { ...f.body, legalFullName: 'Nguyễn Văn Anh' }).expect(200);
    const result = await read(f).expect(200);
    const docs = (result.body as VerificationResponse).data.documents;
    expect(
      docs
        .filter((d) =>
          [
            'PORTRAIT',
            'ID_CARD_FRONT',
            'ID_CARD_BACK',
            'IDENTITY_SELFIE',
          ].includes(d.type),
        )
        .every((d) => d.status === 'PENDING'),
    ).toBe(true);
    expect(
      docs.find((d) => d.type === 'PROFESSIONAL_CERTIFICATE')?.status,
    ).toBe('VERIFIED');
  });

  it('gives support an operational list and owners a verification status without private KYC fields', async () => {
    const f = await fixture();
    await save(f).expect(200);
    const list = await client()
      .get(`/api/admin/provider-members?providerId=${f.provider.id}`)
      .set('Authorization', auth(support.token))
      .expect(200);
    expect(JSON.stringify(list.body)).toContain(f.member.id);
    expect(JSON.stringify(list.body)).not.toMatch(
      /nationalId|birthDate|documents|legalFullName/,
    );
    const owner = await client()
      .get('/api/me/provider/members')
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    expect(JSON.stringify(owner.body)).toContain('verificationStatus');
    expect(JSON.stringify(owner.body)).not.toMatch(
      /nationalId|birthDate|documents|legalFullName/,
    );
    const serviceReviewer = await memberTestReviewer(
      c.prisma,
      c.jwt,
      'SERVICE_REVIEWER',
    );
    await client()
      .get(admin(f))
      .set('Authorization', auth(serviceReviewer.token))
      .expect(403);
  });

  it('escalates an existing owner suspension to INTERNAL so the owner cannot undo a support decision', async () => {
    const f = await fixture();
    await client()
      .post(`/api/me/provider/members/${f.member.id}/suspend`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Tổ chức đang kiểm tra.' })
      .expect(200);
    await client()
      .post(`/api/admin/provider-members/${f.member.id}/suspend`)
      .set('Authorization', auth(support.token))
      .send({ reason: 'Vận hành áp dụng đình chỉ.' })
      .expect(200);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({
      suspensionSource: 'INTERNAL',
      suspendedFromStatus: 'PENDING_VERIFICATION',
    });
    await client()
      .post(`/api/me/provider/members/${f.member.id}/reactivate`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Owner muốn khôi phục.' })
      .expect(403);
    await client()
      .post(`/api/admin/provider-members/${f.member.id}/reactivate`)
      .set('Authorization', auth(support.token))
      .send({ reason: 'Vận hành cho tiếp tục KYC.' })
      .expect(200);
    expect(
      await c.prisma.providerMember.findUniqueOrThrow({
        where: { id: f.member.id },
      }),
    ).toMatchObject({ status: 'PENDING_VERIFICATION' });
  });
});
