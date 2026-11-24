import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import {
  memberTestOrganization,
  memberTestUser,
} from './support/provider-members.fixture';
import { memberTestReviewer } from './support/member-verification.fixture';
import { FEED_MEDIA_STORAGE } from '../src/modules/social-feed/application/feed-media-storage.port';
import { AiRecommendationsService } from '../src/modules/ai-consultation/application/ai-recommendations.service';

type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
type Worker = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
interface Post {
  id: string;
  status: string;
  caption: string;
  revisionNumber: number;
  authorMember: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  provider: { id: string };
  organizationReview?: { status: string | null; note: string | null };
  media: { kind: string; url: string }[];
}
interface Envelope<T> {
  data: T;
}
interface Page {
  data: Post[];
  nextCursor: string | null;
}

describe('organization feed — full AppModule, real authorization, PostgreSQL and Redis', () => {
  let c: Context;
  const imageResult = () => ({
    url: 'https://example.test/work.png',
    secureUrl: 'https://example.test/work.png',
    publicId: `test/feed/${randomUUID()}`,
    format: 'png',
    resourceType: 'image',
    deliveryType: 'upload' as const,
  });
  const videoResult = () => ({
    ...imageResult(),
    format: 'mp4',
    resourceType: 'video',
    durationSeconds: 30,
  });
  const uploadImage = jest.fn(() => Promise.resolve(imageResult()));
  const uploadVideo = jest.fn(() => Promise.resolve(videoResult()));
  const deleteImage = jest.fn(() => Promise.resolve(true)),
    deleteVideo = jest.fn(() => Promise.resolve(true));
  const http = () => request(c.app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const fixture = () => memberCapabilitiesFixture(c);
  const colleague = (f: Worker) =>
    memberCapabilitiesFixture(c, { owner: f.owner, provider: f.provider });
  const path = (id: string) => `/api/me/feed/posts/${id}`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOQAAAABJRU5ErkJggg==',
    'base64',
  );
  function upload(
    f: Worker,
    token = f.worker.token,
    fields: Record<string, string> = {},
    file = { buffer: png, name: 'work.png', type: 'image/png' },
  ) {
    const isVideo = file.type === 'video/mp4';
    let req = http()
      .post(isVideo ? '/api/me/feed/posts/video' : '/api/me/feed/posts')
      .set('Authorization', auth(token))
      .set('Idempotency-Key', randomUUID());
    const body = {
      caption: 'Kiểu tóc đã thực hiện',
      providerServiceIds: JSON.stringify([f.offering.id]),
      includesCustomer: 'false',
      hasCustomerConsent: 'false',
      ...fields,
    };
    for (const [name, value] of Object.entries(body))
      req = req.field(name, value);
    return req.attach(isVideo ? 'file' : 'files', file.buffer, {
      filename: file.name,
      contentType: file.type,
    });
  }
  async function post(f: Worker, token = f.worker.token) {
    const created = (
      (await upload(f, token).expect(201)).body as Envelope<Post>
    ).data;
    // Organization authorization cases explicitly start after platform approval.
    await c.prisma.feedPost.update({
      where: { id: created.id },
      data: { moderationStatus: 'APPROVED', recommendationStatus: 'ELIGIBLE' },
    });
    return created;
  }
  const decide = (
    f: Worker,
    p: Post,
    decision: 'APPROVE' | 'REJECT' = 'APPROVE',
    extras: object = {},
  ) =>
    http()
      .post(`${path(p.id)}/organization-review`)
      .set('Authorization', auth(f.owner.token))
      .send({ decision, revisionNumber: p.revisionNumber, ...extras });
  const manage = (id: string, token: string) =>
    http()
      .get(`${path(id)}/manage`)
      .set('Authorization', auth(token));
  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
    Object.assign(c.app.get(FEED_MEDIA_STORAGE), {
      uploadFeedImage: uploadImage,
      uploadFeedVideo: uploadVideo,
      deleteImage,
      deleteFeedVideo: deleteVideo,
    });
  });
  beforeEach(() => {
    uploadImage
      .mockReset()
      .mockImplementation(() => Promise.resolve(imageResult()));
    uploadVideo
      .mockReset()
      .mockImplementation(() => Promise.resolve(videoResult()));
    deleteImage.mockClear();
    deleteVideo.mockClear();
  });
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  it('requires platform approval for owner and worker uploads and invalidates approval on edit', async () => {
    const f = await fixture();
    const reviewer = await memberTestReviewer(
      c.prisma,
      new JwtService({
        secret: c.app
          .get(ConfigService)
          .getOrThrow<string>('internalAuth.jwtSecret'),
      }),
      'MODERATOR',
    );
    for (const token of [f.owner.token, f.worker.token]) {
      const p = ((await upload(f, token).expect(201)).body as Envelope<Post>)
        .data;
      await http().get(`/api/feed/posts/${p.id}`).expect(404);
      const route = `/api/internal/feed/posts/${p.id}/review`;
      await http()
        .patch(route)
        .set('Authorization', auth(token))
        .send({ revisionNumber: 1, decision: 'APPROVED', eligible: true })
        .expect(401);
      await http()
        .patch(route)
        .set('Authorization', auth(reviewer.token))
        .send({ revisionNumber: 99, decision: 'APPROVED', eligible: true })
        .expect(409);
      await http()
        .patch(route)
        .set('Authorization', auth(reviewer.token))
        .send({ revisionNumber: 1, decision: 'APPROVED', eligible: true })
        .expect(200);
      if (token === f.worker.token) {
        await http().get(`/api/feed/posts/${p.id}`).expect(404);
        await decide(f, p).expect(200);
      }
      await http().get(`/api/feed/posts/${p.id}`).expect(200);
      await http()
        .patch(path(p.id))
        .set('Authorization', auth(token))
        .send({
          revisionNumber: 1,
          caption: 'Updated caption requires moderation',
        })
        .expect(200);
      await http().get(`/api/feed/posts/${p.id}`).expect(404);
    }
  });

  it('moderates reported comments with tombstones, private notices and an independent posting restriction', async () => {
    const f = await fixture(),
      p = await post(f, f.owner.token);
    const viewer = await memberTestUser(c.prisma, c.jwt);
    const secret = c.app
      .get(ConfigService)
      .getOrThrow<string>('internalAuth.jwtSecret');
    const mod = await memberTestReviewer(
      c.prisma,
      new JwtService({ secret }),
      'MODERATOR',
    );
    const admin = await memberTestReviewer(
      c.prisma,
      new JwtService({ secret }),
      'ADMIN',
    );
    const comment = await c.prisma.feedComment.create({
      data: {
        postId: p.id,
        userId: viewer.id,
        text: 'Comment moderation sentinel',
      },
    });
    const reply = await c.prisma.feedComment.create({
      data: {
        postId: p.id,
        userId: f.owner.id,
        parentId: comment.id,
        text: 'Reply survives moderation',
      },
    });
    await http()
      .post(`/api/me/feed/comments/${comment.id}/reports`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'INAPPROPRIATE' })
      .expect(201);
    const report = await c.prisma.feedCommentReport.findFirstOrThrow({
      where: { commentId: comment.id },
    });
    await http()
      .patch(`/api/internal/feed/comment-reports/${report.id}`)
      .set('Authorization', auth(mod.token))
      .send({ hide: true, note: 'Bình luận không phù hợp' })
      .expect(200);
    const comments = await http()
      .get(`/api/feed/posts/${p.id}/comments`)
      .expect(200);
    expect(JSON.stringify(comments.body)).not.toContain(
      'Comment moderation sentinel',
    );
    expect(
      await c.prisma.feedComment.findUnique({ where: { id: reply.id } }),
    ).not.toBeNull();
    const notice = await c.prisma.feedNotice.findFirstOrThrow({
      where: {
        userId: f.owner.id,
        postId: p.id,
        event: 'FEED_REPORT_RESOLVED',
      },
    });
    await http()
      .patch(`/api/me/feed/notices/${notice.id}/read`)
      .set('Authorization', auth(viewer.token))
      .expect(404);
    await http()
      .patch(`/api/me/feed/notices/${notice.id}/read`)
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    const restriction = `/api/internal/feed/providers/${f.provider.id}/posting-restriction`;
    await http()
      .patch(restriction)
      .set('Authorization', auth(mod.token))
      .send({ blocked: true, note: 'Tạm khóa đăng Feed' })
      .expect(403);
    await http()
      .patch(restriction)
      .set('Authorization', auth(admin.token))
      .send({ blocked: true, note: 'Tạm khóa đăng Feed' })
      .expect(200);
    await upload(f, f.owner.token).expect(403);
    await http()
      .get(`${path(p.id)}/manage`)
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    await http()
      .patch(restriction)
      .set('Authorization', auth(admin.token))
      .send({ blocked: false, note: 'Đã xem xét mở lại' })
      .expect(200);
    await http()
      .get('/api/internal/feed/operations')
      .set('Authorization', auth(mod.token))
      .expect(200);
  });

  it('allows appeal of a platform hide, rejects the original reviewer and withdraws stale appeals on edit', async () => {
    const f = await fixture(),
      p = await post(f, f.owner.token);
    const jwt = new JwtService({
      secret: c.app
        .get(ConfigService)
        .getOrThrow<string>('internalAuth.jwtSecret'),
    });
    const mod = await memberTestReviewer(c.prisma, jwt, 'MODERATOR');
    const second = await memberTestReviewer(c.prisma, jwt, 'MODERATOR');
    const hide = () =>
      http()
        .patch(`/api/internal/feed/posts/${p.id}/status`)
        .set('Authorization', auth(mod.token))
        .send({ status: 'HIDDEN' });
    await hide().expect(200);
    await http()
      .post(`${path(p.id)}/appeal`)
      .set('Authorization', auth(f.owner.token))
      .send({ revisionNumber: 1, reason: 'Đề nghị kiểm tra ngữ cảnh' })
      .expect(201);
    const appeal = await c.prisma.feedModerationAppeal.findUniqueOrThrow({
      where: { postId_revisionNumber: { postId: p.id, revisionNumber: 1 } },
    });
    const resolve = (token: string) =>
      http()
        .patch(`/api/internal/feed/appeals/${appeal.id}`)
        .set('Authorization', auth(token))
        .send({ decision: 'REVERSED', note: 'Đã kiểm tra lại ngữ cảnh' });
    await resolve(mod.token).expect(403);
    await resolve(second.token).expect(200);
    await http().get(`/api/feed/posts/${p.id}`).expect(200);
    await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .send({ revisionNumber: 1, caption: 'New revision' })
      .expect(200);
    await c.prisma.feedPost.update({
      where: { id: p.id },
      data: {
        moderationStatus: 'REJECTED',
        moderationReviewedAt: new Date(Date.now() - 31 * 86400000),
      },
    });
    await http()
      .post(`${path(p.id)}/appeal`)
      .set('Authorization', auth(f.owner.token))
      .send({ revisionNumber: 2, reason: 'Khiếu nại đã quá hạn' })
      .expect(409);
    await c.prisma.feedPost.update({
      where: { id: p.id },
      data: { moderationReviewedAt: new Date() },
    });
    await http()
      .post(`${path(p.id)}/appeal`)
      .set('Authorization', auth(f.owner.token))
      .send({ revisionNumber: 2, reason: 'Đề nghị xem lại bản mới' })
      .expect(201);
    await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .send({
        revisionNumber: 2,
        caption: 'Revision three withdraws pending appeal',
      })
      .expect(200);
    expect(
      (
        await c.prisma.feedModerationAppeal.findUniqueOrThrow({
          where: { postId_revisionNumber: { postId: p.id, revisionNumber: 2 } },
        })
      ).status,
    ).toBe('WITHDRAWN');
  });

  it('personalizes authenticated discovery while keeping every public visibility gate', async () => {
    const f = await fixture();
    const viewer = await memberTestUser(c.prisma, c.jwt);
    const visible = await post(f);
    await decide(f, visible).expect(200);
    const pending = await post(f);
    const hidden = await post(f);
    await decide(f, hidden).expect(200);
    await c.prisma.feedPost.update({
      where: { id: hidden.id },
      data: { status: 'HIDDEN' },
    });
    for (const suffix of [
      `posts/${visible.id}/like`,
      `posts/${visible.id}/save`,
      `providers/${f.provider.id}/follow`,
    ]) {
      await http()
        .put(`/api/me/feed/${suffix}`)
        .set('Authorization', auth(viewer.token))
        .expect(200);
    }
    const result = await http()
      .get('/api/me/feed/posts')
      .query({ providerId: f.provider.id, limit: 1 })
      .set('Authorization', auth(viewer.token))
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect((result.body as Envelope<Page>).data).toMatchObject({
      data: [
        {
          id: visible.id,
          viewer: { liked: true, saved: true, followed: true },
        },
      ],
      nextCursor: null,
    });
    expect(JSON.stringify(result.body)).not.toContain('organizationReview');
    await http()
      .get('/api/me/feed/posts')
      .query({ providerId: f.provider.id, cursor: pending.id })
      .set('Authorization', auth(viewer.token))
      .expect(400);
    await c.prisma.user.update({
      where: { id: f.owner.id },
      data: { status: 'BLOCKED' },
    });
    const inactive = await http()
      .get('/api/me/feed/posts')
      .query({ providerId: f.provider.id })
      .set('Authorization', auth(viewer.token))
      .expect(200);
    expect((inactive.body as Envelope<Page>).data.data).toEqual([]);
  });

  it('requires a user session and validates authenticated discovery filters', async () => {
    await http().get('/api/me/feed/posts').expect(401);
    const viewer = await memberTestUser(c.prisma, c.jwt);
    await http()
      .get('/api/me/feed/posts')
      .query({ providerId: 'not-a-uuid' })
      .set('Authorization', auth(viewer.token))
      .expect(400);
    await http()
      .get('/api/me/feed/posts')
      .query({ limit: 51 })
      .set('Authorization', auth(viewer.token))
      .expect(400);
  });

  it('stores worker snapshots and keeps pending posts out of every public feed/AI/profile path', async () => {
    const f = await fixture();
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 0 },
    });
    const p = await post(f);
    expect(p).toMatchObject({
      provider: { id: f.provider.id },
      authorMember: { id: f.member.id },
      organizationReview: { status: 'PENDING' },
      revisionNumber: 1,
    });
    expect(
      await c.prisma.feedPost.findUniqueOrThrow({ where: { id: p.id } }),
    ).toMatchObject({ authorMembershipVersion: 1, authorRole: 'WORKER' });
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    await http()
      .get(path(p.id))
      .set('Authorization', auth(f.worker.token))
      .expect(404);
    const list = (
      await http()
        .get('/api/feed/posts')
        .query({ providerId: f.provider.id })
        .expect(200)
    ).body as Envelope<Page>;
    expect(list.data.data).toEqual([]);
    expect(
      (await http().get(`/api/providers/${f.provider.id}/public`).expect(200))
        .body,
    ).toMatchObject({ data: { portfolio: [] } });
    expect(
      await c.app.get(AiRecommendationsService).posts([f.catalog.id]),
    ).toEqual([]);
    await http()
      .put(`${path(p.id)}/like`)
      .set('Authorization', auth(f.owner.token))
      .expect(404);
    await http()
      .post(`${path(p.id)}/comments`)
      .set('Authorization', auth(f.owner.token))
      .send({ text: 'Not public' })
      .expect(404);
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it('publishes an owner-approved worker post once, preserving public privacy and existing social actions', async () => {
    const f = await fixture(),
      p = await post(f);
    await decide(f, p).expect(200);
    const publicPost = (
      (await http().get(`/api/feed/posts/${p.id}`).expect(200))
        .body as Envelope<Post>
    ).data;
    expect(publicPost.authorMember?.id).toBe(f.member.id);
    for (const field of [
      'organizationReview',
      'authorMembershipVersion',
      'organizationReviewedByUserId',
      'authorMemberId',
      'publicId',
    ])
      expect(publicPost).not.toHaveProperty(field);
    expect(JSON.stringify(publicPost)).not.toContain(f.body.nationalIdNumber);
    expect(JSON.stringify(publicPost)).not.toContain(f.worker.id);
    const ai = await c.app.get(AiRecommendationsService).posts([f.catalog.id]);
    expect(ai.map((v) => v.id)).toContain(p.id);
    expect(
      (await http().get(`/api/providers/${f.provider.id}/public`).expect(200))
        .body,
    ).toMatchObject({
      data: { portfolio: [expect.objectContaining({ id: p.id })] },
    });
    await http()
      .put(`${path(p.id)}/like`)
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    await http()
      .post(`${path(p.id)}/comments`)
      .set('Authorization', auth(f.owner.token))
      .send({ text: 'Tóc đẹp.' })
      .expect(201);
    expect(
      await c.prisma.auditLog.count({
        where: { resourceId: p.id, action: 'FEED_ORGANIZATION_REVIEWED' },
      }),
    ).toBe(1);
  });

  it('lets the organization owner publish official content without worker qualification or wallet funds', async () => {
    const f = await fixture();
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 0 },
    });
    const p = await post(f, f.owner.token);
    expect(p.organizationReview?.status).toBe('APPROVED');
    expect(
      await c.prisma.feedPost.findUniqueOrThrow({ where: { id: p.id } }),
    ).toMatchObject({
      authorRole: 'OWNER',
      organizationReviewedByUserId: f.owner.id,
    });
    await http().get(`/api/feed/posts/${p.id}`).expect(200);
  });

  it('keeps individual-provider create/update/delete behavior with no organization review', async () => {
    const individual = await memberTestOrganization(c.prisma, c.jwt, true),
      f = await memberCapabilitiesFixture(c, individual);
    const p = await post(f, f.owner.token);
    expect(p.authorMember).toBeNull();
    expect(p.organizationReview?.status).toBeNull();
    await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .send({ caption: 'Updated individual caption' })
      .expect(200);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    await decide(f, { ...p, revisionNumber: 2 }).expect(403);
    await http()
      .delete(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    expect(
      await c.prisma.feedPost.count({ where: { id: p.id, status: 'DELETED' } }),
    ).toBe(1);
  });

  it('requires owner authority and forbids body-controlled authorship or publication', async () => {
    const f = await fixture(),
      p = await post(f),
      other = await fixture();
    await http()
      .post(`${path(p.id)}/organization-review`)
      .send({ decision: 'APPROVE', revisionNumber: 1 })
      .expect(401);
    await http()
      .post(`${path(p.id)}/organization-review`)
      .set('Authorization', auth(f.worker.token))
      .send({ decision: 'APPROVE', revisionNumber: 1 })
      .expect(403);
    await decide(other, p).expect(404);
    const invalidFields: Record<string, string>[] = [
      { authorMemberId: f.member.id },
      { providerId: f.provider.id },
      { organizationReviewStatus: 'APPROVED' },
      { memberId: other.member.id },
    ];
    for (const fields of invalidFields) {
      await upload(f, f.worker.token, fields).expect(
        fields.memberId ? 403 : 400,
      );
    }
    for (const body of [
      { caption: null },
      { providerServiceIds: null },
      { caption: 'new', status: 'PUBLISHED' },
      { caption: 'new', authorMemberId: other.member.id },
    ])
      await http()
        .patch(path(p.id))
        .set('Authorization', auth(f.worker.token))
        .send(body)
        .expect(400);
  });

  it('keeps rejection reasons private and returns rejected posts to pending after editing', async () => {
    const f = await fixture(),
      p = await post(f),
      b = await colleague(f);
    await decide(f, p, 'REJECT').expect(400);
    await decide(f, p, 'REJECT', {
      note: 'Ảnh chưa thể hiện sản phẩm rõ.',
    }).expect(200);
    expect((await manage(p.id, f.worker.token).expect(200)).body).toMatchObject(
      {
        data: {
          organizationReview: {
            status: 'REJECTED',
            note: 'Ảnh chưa thể hiện sản phẩm rõ.',
          },
        },
      },
    );
    await manage(p.id, b.worker.token).expect(404);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    const edited = await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.worker.token))
      .send({ caption: 'Giới thiệu rõ hơn về mẫu tóc', revisionNumber: 1 })
      .expect(200);
    expect(edited.body).toMatchObject({
      data: {
        revisionNumber: 2,
        organizationReview: { status: 'PENDING', note: null },
      },
    });
  });

  it('requires a fresh review after a worker edits an approved post and rejects a stale review revision', async () => {
    const f = await fixture(),
      p = await post(f);
    await decide(f, p).expect(200);
    const edited = (
      (
        await http()
          .patch(path(p.id))
          .set('Authorization', auth(f.worker.token))
          .send({ caption: 'Nội dung mới', revisionNumber: 1 })
          .expect(200)
      ).body as Envelope<Post>
    ).data;
    expect(edited).toMatchObject({
      revisionNumber: 2,
      organizationReview: { status: 'PENDING' },
    });
    await decide(f, p).expect(409);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    await decide(f, edited).expect(200);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
  });

  it('does not let owner edits bypass worker service assignments or the review gate', async () => {
    const f = await fixture(),
      p = await post(f),
      b = await colleague(f);
    await decide(f, p).expect(200);
    await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .send({ providerServiceIds: [b.offering.id] })
      .expect(403);
    const updated = await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .send({ caption: 'Owner sửa chú thích' })
      .expect(200);
    expect(updated.body).toMatchObject({
      data: { revisionNumber: 2, organizationReview: { status: 'PENDING' } },
    });
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
  });

  it('allows owner rejection to withdraw a published post without changing platform moderation', async () => {
    const f = await fixture(),
      p = await post(f);
    await decide(f, p).expect(200);
    await decide(f, p, 'REJECT', {
      note: 'Cần kiểm tra lại nội dung đã công bố.',
    }).expect(200);
    expect(
      await c.prisma.feedPost.findUniqueOrThrow({ where: { id: p.id } }),
    ).toMatchObject({
      status: 'PUBLISHED',
      organizationReviewStatus: 'REJECTED',
    });
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
  });

  it('cannot undo a platform hide through owner approval or undo rejection through platform restore', async () => {
    const f = await fixture(),
      p = await post(f);
    const internal = new JwtService({
      secret: c.app
        .get(ConfigService)
        .getOrThrow<string>('internalAuth.jwtSecret'),
    });
    const reviewer = await memberTestReviewer(c.prisma, internal, 'MODERATOR');
    const platform = (status: string) =>
      http()
        .patch(`/api/internal/feed/posts/${p.id}/status`)
        .set('Authorization', auth(reviewer.token))
        .send({ status });
    await platform('HIDDEN').expect(200);
    await decide(f, p).expect(200);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    expect((await manage(p.id, f.owner.token).expect(200)).body).toMatchObject({
      data: { status: 'HIDDEN', organizationReview: { status: 'APPROVED' } },
    });
    await decide(f, p, 'REJECT', {
      note: 'Owner cũng từ chối nội dung.',
    }).expect(200);
    await platform('PUBLISHED').expect(404);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
  });

  it('keeps worker private reads, edits and deletes isolated from colleagues and organization owners elsewhere', async () => {
    const f = await fixture(),
      p = await post(f),
      b = await colleague(f),
      ownerPost = await post(f, f.owner.token),
      other = await fixture();
    for (const token of [b.worker.token, other.owner.token]) {
      await manage(p.id, token).expect(404);
      await http()
        .patch(path(p.id))
        .set('Authorization', auth(token))
        .send({ caption: 'Unauthorized edit' })
        .expect(404);
      await http()
        .delete(path(p.id))
        .set('Authorization', auth(token))
        .expect(404);
    }
    await http()
      .patch(path(ownerPost.id))
      .set('Authorization', auth(f.worker.token))
      .send({ caption: 'Cannot edit owner' })
      .expect(404);
    const mine = (
      (
        await http()
          .get('/api/me/feed/mine')
          .set('Authorization', auth(f.worker.token))
          .expect(200)
      ).body as Envelope<Page>
    ).data;
    expect(mine.data.map((row) => row.id)).toEqual([p.id]);
    await http()
      .get('/api/me/feed/mine')
      .set('Authorization', auth(b.worker.token))
      .query({ cursor: p.id })
      .expect(400);
    const owner = (
      (
        await http()
          .get('/api/me/feed/mine')
          .set('Authorization', auth(f.owner.token))
          .query({ organizationReviewStatus: 'PENDING' })
          .expect(200)
      ).body as Envelope<Page>
    ).data;
    expect(owner.data.map((row) => row.id)).toContain(p.id);
    expect(owner.data.map((row) => row.id)).not.toContain(ownerPost.id);
  });

  it('denies suspended, left, unqualified and unassigned workers before uploading', async () => {
    for (const state of ['SUSPENDED', 'LEFT'] as const) {
      const f = await fixture();
      await c.prisma.providerMember.update({
        where: { id: f.member.id },
        data: {
          status: state,
          ...(state === 'LEFT' && { leftAt: new Date() }),
        },
      });
      await upload(f).expect(403);
    }
    const f = await fixture();
    await c.prisma.providerMemberService.updateMany({
      where: { memberId: f.member.id },
      data: { enabled: false },
    });
    await upload(f).expect(403);
    const expired = await fixture();
    await c.prisma.providerMemberDocument.updateMany({
      where: {
        verificationId: expired.profile.id,
        type: 'PROFESSIONAL_CERTIFICATE',
      },
      data: { expiresAt: new Date(Date.now() - 86400000) },
    });
    await upload(expired).expect(403);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('rechecks qualifications at approval and refuses inactive service/category links', async () => {
    const f = await fixture(),
      p = await post(f);
    await c.prisma.providerMemberService.updateMany({
      where: { memberId: f.member.id },
      data: { enabled: false },
    });
    await decide(f, p).expect(403);
    const b = await fixture();
    await c.prisma.serviceCategory.update({
      where: { id: b.category.id },
      data: { status: 'INACTIVE' },
    });
    await upload(b).expect(400);
  });

  it('preserves snapshots but revokes old private authority through leaving and rejoining', async () => {
    const f = await fixture(),
      p = await post(f);
    await decide(f, p).expect(200);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
        displayName: 'Changed public name',
      },
    });
    await manage(p.id, f.worker.token).expect(404);
    expect(
      (
        (await http().get(`/api/feed/posts/${p.id}`).expect(200))
          .body as Envelope<Post>
      ).data.authorMember,
    ).toEqual(p.authorMember);
    await decide(f, p, 'REJECT', {
      note: 'Ẩn bài của nhân viên đã nghỉ.',
    }).expect(200);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'ACTIVE', leftAt: null, membershipVersion: 2 },
    });
    await manage(p.id, f.worker.token).expect(404);
    await http()
      .patch(path(p.id))
      .set('Authorization', auth(f.worker.token))
      .send({ caption: 'Old term edit' })
      .expect(404);
    await decide(f, p).expect(409);
  });

  it('cleans uploaded images when suspension happens during the upload', async () => {
    const f = await fixture(),
      result = imageResult();
    uploadImage.mockImplementationOnce(async () => {
      await c.prisma.providerMember.update({
        where: { id: f.member.id },
        data: { status: 'SUSPENDED' },
      });
      return result;
    });
    await upload(f).expect(403);
    expect(deleteImage).toHaveBeenCalledWith(result.publicId, 'upload');
    expect(
      await c.prisma.feedPost.count({ where: { providerId: f.provider.id } }),
    ).toBe(0);
  });

  it('rolls back create and removes its upload when auditing fails', async () => {
    const f = await fixture();
    const spy = jest
      .spyOn(c.audit, 'record')
      .mockRejectedValueOnce(new Error('Simulated feed audit failure'));
    try {
      await upload(f).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      await c.prisma.feedPost.count({ where: { providerId: f.provider.id } }),
    ).toBe(0);
    expect(deleteImage).toHaveBeenCalledTimes(1);
  });

  it('supports short video pending review and cleans a video over sixty seconds', async () => {
    const f = await fixture(),
      file = {
        buffer: Buffer.from('....ftypisom', 'ascii'),
        name: 'clip.mp4',
        type: 'video/mp4',
      };
    const video = (
      (await upload(f, f.worker.token, {}, file).expect(201))
        .body as Envelope<Post>
    ).data;
    expect(video).toMatchObject({
      media: [{ kind: 'VIDEO' }],
      organizationReview: { status: 'PENDING' },
    });
    uploadVideo.mockImplementationOnce(() =>
      Promise.resolve({
        ...videoResult(),
        durationSeconds: 61,
      }),
    );
    await upload(f, f.worker.token, {}, file).expect(400);
    expect(deleteVideo).toHaveBeenCalledTimes(1);
  });

  it('rejects missing customer-image consent and invalid binary content', async () => {
    const f = await fixture();
    const customer = await memberTestUser(c.prisma, c.jwt);
    await upload(f, customer.token).expect(403);
    const pending = await post(f);
    await manage(pending.id, customer.token).expect(404);
    expect(
      (
        await http()
          .get('/api/me/feed/mine')
          .set('Authorization', auth(customer.token))
          .expect(200)
      ).body,
    ).toMatchObject({ data: { data: [] } });
    await upload(f, f.worker.token, { includesCustomer: 'true' }).expect(400);
    await upload(
      f,
      f.worker.token,
      {},
      {
        buffer: Buffer.from('not an image'),
        name: 'fake.png',
        type: 'image/png',
      },
    ).expect(400);
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it('serializes duplicate approval and concurrent approval/edit without publishing unreviewed changes', async () => {
    const f = await fixture(),
      p = await post(f);
    const responses = await Promise.all([decide(f, p), decide(f, p)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await c.prisma.auditLog.count({
        where: { resourceId: p.id, action: 'FEED_ORGANIZATION_REVIEWED' },
      }),
    ).toBe(1);
    const next = await post(f);
    const concurrent = await Promise.all([
      decide(f, next),
      http()
        .patch(path(next.id))
        .set('Authorization', auth(f.worker.token))
        .send({ caption: 'Concurrent new content' }),
    ]);
    expect([200, 409]).toContain(concurrent[0].status);
    expect(concurrent[1].status).toBe(200);
    expect(
      await c.prisma.feedPost.findUniqueOrThrow({ where: { id: next.id } }),
    ).toMatchObject({ revisionNumber: 2, organizationReviewStatus: 'PENDING' });
    await http().get(`/api/feed/posts/${next.id}`).expect(404);
  });

  it('paginates public posts without admitting a pending post or using its cursor', async () => {
    const f = await fixture(),
      pending = await post(f),
      first = await post(f, f.owner.token),
      second = await post(f, f.owner.token);
    const page1 = (
      (
        await http()
          .get('/api/feed/posts')
          .query({ providerId: f.provider.id, limit: 1 })
          .expect(200)
      ).body as Envelope<Page>
    ).data;
    const page2 = (
      (
        await http()
          .get('/api/feed/posts')
          .query({
            providerId: f.provider.id,
            limit: 1,
            cursor: page1.nextCursor,
          })
          .expect(200)
      ).body as Envelope<Page>
    ).data;
    expect([...page1.data, ...page2.data].map((p) => p.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect(page2.nextCursor).toBeNull();
    await http()
      .get('/api/feed/posts')
      .query({ providerId: f.provider.id, cursor: pending.id })
      .expect(400);
  });

  it('removes rejected posts from following and saved feeds without deleting viewer history', async () => {
    const f = await fixture(),
      p = await post(f),
      customer = await memberTestUser(c.prisma, c.jwt);
    await decide(f, p).expect(200);
    await http()
      .put(`/api/me/feed/providers/${f.provider.id}/follow`)
      .set('Authorization', auth(customer.token))
      .expect(200);
    await http()
      .put(`${path(p.id)}/save`)
      .set('Authorization', auth(customer.token))
      .expect(200);
    await decide(f, p, 'REJECT', {
      note: 'Cần bổ sung thông tin sản phẩm.',
    }).expect(200);
    for (const endpoint of ['following', 'saved']) {
      expect(
        (
          await http()
            .get(`/api/me/feed/${endpoint}`)
            .query({ providerId: f.provider.id })
            .set('Authorization', auth(customer.token))
            .expect(200)
        ).body,
      ).toMatchObject({ data: { data: [] } });
    }
    expect(
      await c.prisma.feedSave.count({
        where: { postId: p.id, userId: customer.id },
      }),
    ).toBe(1);
    await http().get(`/api/feed/posts/${p.id}/comments`).expect(404);
  });

  it('soft-deletes with an audit and prevents approval or public access after deletion', async () => {
    const f = await fixture(),
      p = await post(f);
    await http()
      .delete(path(p.id))
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    await decide(f, p).expect(404);
    await http().get(`/api/feed/posts/${p.id}`).expect(404);
    expect(
      await c.prisma.auditLog.count({
        where: { resourceId: p.id, action: 'FEED_POST_DELETED' },
      }),
    ).toBe(1);
  });

  it('enforces authorship and revision guards when writes bypass application services', async () => {
    const f = await fixture(),
      p = await post(f),
      b = await colleague(f);
    await expect(
      c.prisma.feedPost.update({
        where: { id: p.id },
        data: { authorMemberId: b.member.id },
      }),
    ).rejects.toThrow('Feed authorship is immutable');
    await expect(
      c.prisma.feedPost.update({
        where: { id: p.id },
        data: { caption: 'Bypassed edit' },
      }),
    ).rejects.toThrow('Feed edits require a new revision');
    await expect(
      c.prisma.feedPost.update({
        where: { id: p.id },
        data: {
          organizationReviewStatus: 'APPROVED',
          organizationReviewedAt: new Date(),
          organizationReviewedByUserId: b.worker.id,
        },
      }),
    ).rejects.toThrow('Organization review requires its owner');
    await expect(
      c.prisma.feedPost.create({
        data: {
          providerId: f.provider.id,
          caption: 'Forged author',
          authorMemberId: b.member.id,
          authorMembershipVersion: 2,
          authorRole: 'WORKER',
          authorDisplayName: 'Fake',
          organizationReviewStatus: 'PENDING',
        },
      }),
    ).rejects.toThrow('Feed author must match current organization membership');
  });
});
