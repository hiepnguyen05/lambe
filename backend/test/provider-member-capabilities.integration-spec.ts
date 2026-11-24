import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { createMemberVerificationTestApp } from './support/member-verification-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import { memberTestOrder } from './support/member-verification.fixture';
import { memberTestUser } from './support/provider-members.fixture';
import { vietnameseDayAndMinute } from '../src/modules/orders/domain/order-time.policy';
import { MaintenanceService } from '../src/infrastructure/maintenance/maintenance.service';

type Fixture = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
interface StatusBody {
  data: {
    online: boolean;
    session: { id: string } | null;
    receivingEligibility: { eligible: boolean; blockerCode: string | null };
  };
}
interface ServiceBody {
  data: {
    providerServiceId: string;
    eligible: boolean;
    enabled: boolean;
    blockerCode: string | null;
  }[];
}

describe('member capabilities HTTP + PostgreSQL + Redis', () => {
  let c: Awaited<ReturnType<typeof createMemberVerificationTestApp>>;
  let locations: RedisCacheService;
  const ids: string[] = [];
  const self = (f: Fixture) => `/api/me/provider/memberships/${f.member.id}`;
  const owner = (f: Fixture) => `/api/me/provider/members/${f.member.id}`;
  const client = () => request(c.app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const gps = (offset = 0) => ({
    latitude: 21.0285,
    longitude: 105.8542,
    capturedAt: new Date(Date.now() + offset).toISOString(),
  });
  async function fixture() {
    const f = await memberCapabilitiesFixture(c);
    ids.push(f.member.id);
    return f;
  }
  const online = (f: Fixture, token = f.worker.token, body = gps()) =>
    client()
      .post(`${self(f)}/availability/online`)
      .set('Authorization', auth(token))
      .send(body);
  const status = (f: Fixture) =>
    client()
      .get(`${self(f)}/availability`)
      .set('Authorization', auth(f.worker.token));
  async function session(f: Fixture) {
    const response = await online(f).expect(200);
    return (response.body as StatusBody).data.session!.id;
  }
  const heartbeat = (f: Fixture, sessionId: string, body = gps(1000)) =>
    client()
      .post(`${self(f)}/availability/heartbeat`)
      .set('Authorization', auth(f.worker.token))
      .send({ ...body, sessionId });
  const offline = (f: Fixture, sessionId: string) =>
    client()
      .post(`${self(f)}/availability/offline`)
      .set('Authorization', auth(f.worker.token))
      .send({ sessionId });
  const assign = (
    f: Fixture,
    providerServiceIds: string[],
    token = f.owner.token,
    extra = {},
  ) =>
    client()
      .put(`${owner(f)}/services`)
      .set('Authorization', auth(token))
      .send({ providerServiceIds, ...extra });

  beforeAll(async () => {
    const url = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15';
    if (new URL(url).pathname !== '/15')
      throw new Error(
        'Member integration requires isolated Redis database 15.',
      );
    locations = new RedisCacheService(
      new ConfigService({
        cache: { enabled: true, url, providerLocationTtlSeconds: 120 },
      }),
    );
    c = await createMemberVerificationTestApp(locations);
    if (locations.getStatus() !== 'up')
      throw new Error('Redis test database is unavailable.');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const id of ids)
      await locations.removeMemberPosition(id, 2_000_000_000);
    await c?.app.close();
    await c?.prisma.$disconnect();
    await locations?.onModuleDestroy();
  });

  it('requires authentication and hides another member’s schedules/services/GPS', async () => {
    const f = await fixture();
    const outsider = await memberTestUser(c.prisma, c.jwt);
    await client()
      .get(`${self(f)}/working-hours`)
      .expect(401);
    await client()
      .get(`${self(f)}/working-hours`)
      .set('Authorization', auth(outsider.token))
      .expect(403);
    await online(f, f.owner.token).expect(404);
    await client()
      .get(`${self(f)}/receiving-settings`)
      .set('Authorization', auth(f.owner.token))
      .expect(404);
    await client()
      .get(`${self(f)}/services`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
  });

  it('allows only owner to grant qualified services; no mass assignment of prices', async () => {
    const f = await fixture();
    await assign(f, [f.offering.id], f.worker.token).expect(403);
    await assign(f, [f.offering.id], f.owner.token, { priceAmount: 1 }).expect(
      400,
    );
    const response = await assign(f, [f.offering.id]).expect(200);
    expect((response.body as ServiceBody).data[0]).toMatchObject({
      enabled: true,
      eligible: true,
    });
    const options = await client()
      .get(`${owner(f)}/service-options`)
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    expect(JSON.stringify(options.body)).not.toMatch(
      /nationalId|publicId|birthDate|balanceAmount/,
    );
  });

  it('rejects foreign organization services in both API and database', async () => {
    const f = await fixture(),
      other = await fixture();
    await assign(f, [other.offering.id]).expect(400);
    await assign(f, [f.offering.id], other.owner.token).expect(404);
    await expect(
      c.prisma.providerMemberService.create({
        data: {
          memberId: f.member.id,
          membershipVersion: 1,
          providerServiceId: other.offering.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('revokes all services, closes online, and prevents renewed heartbeat', async () => {
    const f = await fixture();
    const id = await session(f);
    await assign(f, []).expect(200);
    expect((await status(f)).body).toMatchObject({
      data: {
        online: false,
        receivingEligibility: { blockerCode: 'NO_QUALIFIED_MEMBER_SERVICE' },
      },
    });
    await heartbeat(f, id).expect(409);
  });

  it('blocks pending KYC and expired/revoked service certificates', async () => {
    const f = await fixture();
    await c.prisma.providerMemberVerification.update({
      where: { id: f.profile.id },
      data: { status: 'PENDING_REVIEW' },
    });
    await assign(f, [f.offering.id]).expect(409);
    await online(f).expect(409);
    await c.prisma.providerMemberVerification.update({
      where: { id: f.profile.id },
      data: { status: 'APPROVED' },
    });
    await c.prisma.providerMemberDocument.updateMany({
      where: { verificationId: f.profile.id, type: 'PROFESSIONAL_CERTIFICATE' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await assign(f, [f.offering.id]).expect(409);
    await online(f).expect(409);
  });

  it('expiry blocks only the affected service while another qualified service remains usable', async () => {
    const f = await fixture();
    const second = await c.prisma.service.create({
      data: {
        categoryId: f.category.id,
        code: `SECOND_${randomUUID().replaceAll('-', '_').toUpperCase()}`,
        name: 'Qualified second',
        normalizedName: `second-${randomUUID()}`,
        slug: `second-${randomUUID()}`,
        status: 'ACTIVE',
        minPriceAmount: 50_000,
        maxPriceAmount: 500_000,
        requiresCertificate: false,
        minPortfolioImages: 0,
      },
    });
    const offering = await c.prisma.providerService.create({
      data: {
        providerId: f.provider.id,
        sourceApplicationId: f.provider.sourceApplicationId,
        serviceId: second.id,
        priceAmount: 100_000,
        status: 'ACTIVE',
      },
    });
    await c.prisma.providerMemberVerification.update({
      where: { id: f.profile.id },
      data: { requestedProviderServiceIds: [f.offering.id, offering.id] },
    });
    await c.prisma.providerMemberService.create({
      data: {
        memberId: f.member.id,
        membershipVersion: 1,
        providerServiceId: offering.id,
      },
    });
    await c.prisma.providerMemberDocument.updateMany({
      where: { verificationId: f.profile.id, type: 'PROFESSIONAL_CERTIFICATE' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const response = await client()
      .get(`${self(f)}/services`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    expect(
      (response.body as ServiceBody).data.find(
        (x) => x.providerServiceId === f.offering.id,
      )?.eligible,
    ).toBe(false);
    expect(
      (response.body as ServiceBody).data.find(
        (x) => x.providerServiceId === offering.id,
      )?.eligible,
    ).toBe(true);
    await online(f).expect(200);
  });

  it('rechecks category status and catalog price range instead of trusting assignments', async () => {
    const f = await fixture();
    await c.prisma.serviceCategory.update({
      where: { id: f.category.id },
      data: { status: 'INACTIVE' },
    });
    await online(f).expect(409);
    await c.prisma.serviceCategory.update({
      where: { id: f.category.id },
      data: { status: 'ACTIVE' },
    });
    await c.prisma.providerService.update({
      where: { id: f.offering.id },
      data: { priceAmount: 40_000 },
    });
    await online(f).expect(409);
  });

  it('owner edits schedules with reason; rejects overlapping or invalid hours', async () => {
    const f = await fixture();
    await client()
      .put(`${owner(f)}/working-hours`)
      .set('Authorization', auth(f.owner.token))
      .send({ workingHours: [] })
      .expect(409);
    const workingHours = [{ dayOfWeek: 1, startMinute: 480, endMinute: 1200 }];
    await client()
      .put(`${owner(f)}/working-hours`)
      .set('Authorization', auth(f.owner.token))
      .send({ workingHours, reason: 'Thay đổi lịch theo thỏa thuận.' })
      .expect(200);
    expect(
      await c.prisma.auditLog.count({
        where: {
          resourceId: f.member.id,
          actorUserId: f.owner.id,
          action: 'PROVIDER_MEMBER_HOURS_CHANGED',
        },
      }),
    ).toBe(1);
    await client()
      .put(`${self(f)}/working-hours`)
      .set('Authorization', auth(f.worker.token))
      .send({
        workingHours: [
          ...workingHours,
          { dayOfWeek: 1, startMinute: 1000, endMinute: 1300 },
        ],
      })
      .expect(400);
    await client()
      .put(`${self(f)}/working-hours`)
      .set('Authorization', auth(f.worker.token))
      .send({
        workingHours: [{ dayOfWeek: 7, startMinute: 0, endMinute: 1440 }],
      })
      .expect(400);
  });

  it('database prevents overlapping hours even if DTO is bypassed', async () => {
    const f = await fixture();
    await expect(
      c.prisma.providerMemberWorkingHour.create({
        data: {
          memberId: f.member.id,
          membershipVersion: 1,
          dayOfWeek: 1,
          startMinute: 1,
          endMinute: 2,
        },
      }),
    ).rejects.toThrow();
  });

  it('empty weekly schedule prevents online and closing schedule invalidates existing session', async () => {
    const f = await fixture();
    const id = await session(f);
    await client()
      .put(`${self(f)}/working-hours`)
      .set('Authorization', auth(f.worker.token))
      .send({ workingHours: [] })
      .expect(200);
    expect((await status(f)).body).toMatchObject({
      data: {
        online: false,
        receivingEligibility: { blockerCode: 'MEMBER_WORKING_HOURS_REQUIRED' },
      },
    });
    await heartbeat(f, id).expect(409);
  });

  it('validates timezone, ranges, overlap, pagination and ownership for time-off', async () => {
    const f = await fixture();
    const body = {
      startAt: new Date(Date.now() + 3_600_000).toISOString(),
      endAt: new Date(Date.now() + 7_200_000).toISOString(),
    };
    const post = () =>
      client()
        .post(`${self(f)}/time-offs`)
        .set('Authorization', auth(f.worker.token));
    await post()
      .send({ ...body, startAt: '2026-11-01T08:00:00' })
      .expect(400);
    await post()
      .send({ ...body, endAt: body.startAt })
      .expect(400);
    const added = await post().send(body).expect(201);
    const id = (added.body as { data: { id: string } }).data.id;
    await post().send(body).expect(409);
    await client()
      .get(`${self(f)}/time-offs`)
      .set('Authorization', auth(f.worker.token))
      .query({ limit: 51 })
      .expect(400);
    const other = await fixture();
    await client()
      .delete(`${self(other)}/time-offs/${id}`)
      .set('Authorization', auth(other.worker.token))
      .send({})
      .expect(404);
    await client()
      .delete(`${owner(f)}/time-offs/${id}`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Đổi lịch nghỉ theo yêu cầu.' })
      .expect(200);
    await client()
      .delete(`${self(f)}/time-offs/${id}`)
      .set('Authorization', auth(f.worker.token))
      .send({})
      .expect(200);
    expect(
      (
        await c.prisma.providerMemberTimeOff.findUniqueOrThrow({
          where: { id },
        })
      ).cancelledAt,
    ).not.toBeNull();
  });

  it('active time-off prevents online', async () => {
    const f = await fixture();
    await c.prisma.providerMemberTimeOff.create({
      data: {
        memberId: f.member.id,
        membershipVersion: 1,
        startAt: new Date(Date.now() - 60_000),
        endAt: new Date(Date.now() + 60_000),
      },
    });
    const response = await online(f).expect(409);
    expect(response.body).toMatchObject({ code: 'MEMBER_TIME_OFF' });
  });

  it('protects existing organization obligations before changing capabilities', async () => {
    const f = await fixture();
    await memberTestOrder(c.prisma, f);
    await assign(f, []).expect(409);
    await client()
      .put(`${self(f)}/working-hours`)
      .set('Authorization', auth(f.worker.token))
      .send({ workingHours: [] })
      .expect(409);
  });

  it('radius is member-specific and capped by organization, without exposing wallet balances', async () => {
    const f = await fixture();
    const put = () =>
      client()
        .put(`${self(f)}/receiving-settings`)
        .set('Authorization', auth(f.worker.token));
    await put().send({ receivingRadiusKm: 16 }).expect(400);
    await put().send({ receivingRadiusKm: 5 }).expect(200);
    await c.prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { serviceRadiusKm: 3 },
    });
    const response = await client()
      .get(`${self(f)}/receiving-settings`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    expect(response.body).toMatchObject({
      data: { receivingRadiusKm: 5, effectiveRadiusKm: 3 },
    });
    expect(JSON.stringify((await status(f)).body)).not.toMatch(
      /balanceAmount|availableBalance|heldAmount/,
    );
  });

  it('requires at least 50k available organization balance including holds', async () => {
    const f = await fixture();
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 100_000, heldAmount: 50_001 },
    });
    expect((await online(f).expect(409)).body).toMatchObject({
      code: 'ORGANIZATION_WALLET_BALANCE_TOO_LOW',
    });
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { heldAmount: 50_000 },
    });
    await online(f).expect(200);
  });

  it('publishes GPS to member namespace and requires the current session for heartbeat/offline', async () => {
    const f = await fixture();
    const id = await session(f);
    const position = await locations.getMemberPosition(f.member.id, id);
    expect(position?.latitude).toBeCloseTo(21.0285, 4);
    expect(position?.longitude).toBeCloseTo(105.8542, 4);
    expect(await locations.getPosition(f.provider.id)).toBeNull();
    await heartbeat(f, id).expect(200);
    const old = await online(f, f.worker.token, gps(2000)).expect(200);
    const newId = (old.body as StatusBody).data.session!.id;
    await heartbeat(f, id, gps(3000)).expect(409);
    await offline(f, id).expect(409);
    expect((await status(f)).body).toMatchObject({
      data: { online: true, session: { id: newId } },
    });
    await offline(f, newId).expect(200);
    await offline(f, newId).expect(200);
    expect((await status(f)).body).toMatchObject({ data: { online: false } });
  });

  it('rejects stale/future GPS and never revives an expired session', async () => {
    const f = await fixture();
    await online(f, f.worker.token, gps(-61_000)).expect(400);
    await online(f, f.worker.token, gps(16_000)).expect(400);
    const id = await session(f);
    await c.prisma.providerMemberAvailabilitySession.update({
      where: { id },
      data: { lastHeartbeatAt: new Date(Date.now() - 121_000) },
    });
    expect((await status(f)).body).toMatchObject({ data: { online: false } });
    await heartbeat(f, id).expect(409);
    expect(
      (
        await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
          where: { id },
        })
      ).endReason,
    ).toBe('HEARTBEAT_EXPIRED');
  });

  it('suspend/reopen/rejoin invalidate sessions and old membership configuration', async () => {
    const f = await fixture();
    const id = await session(f);
    await client()
      .post(`${owner(f)}/suspend`)
      .set('Authorization', auth(f.owner.token))
      .send({ reason: 'Tạm đình chỉ kiểm tra hồ sơ.' })
      .expect(200);
    expect(
      (
        await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
          where: { id },
        })
      ).endedAt,
    ).not.toBeNull();
    await online(f).expect(409);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'ACTIVE', membershipVersion: 2 },
    });
    const read = await client()
      .get(`${self(f)}/services`)
      .set('Authorization', auth(f.worker.token))
      .expect(200);
    expect((read.body as ServiceBody).data).toEqual([]);
    await online(f).expect(409);
  });

  it('organization suspension closes all sessions without cancelling orders or auto-restarting on restore', async () => {
    const f = await fixture();
    const id = await session(f);
    await c.prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { status: 'SUSPENDED' },
    });
    expect(
      (
        await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
          where: { id },
        })
      ).endReason,
    ).toBe('PROVIDER_UNAVAILABLE');
    await c.prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { status: 'ACTIVE' },
    });
    expect((await status(f)).body).toMatchObject({ data: { online: false } });
    await heartbeat(f, id).expect(409);
  });

  it('owner/user account suspension closes sessions even without membership changes', async () => {
    const f = await fixture();
    const id = await session(f);
    await c.prisma.user.update({
      where: { id: f.owner.id },
      data: { status: 'BLOCKED' },
    });
    expect(
      (
        await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
          where: { id },
        })
      ).endReason,
    ).toBe('USER_UNAVAILABLE');
    await online(f).expect(409);
  });

  it('Redis failure does not report successful online and offline still commits', async () => {
    const f = await fixture();
    const save = jest
      .spyOn(locations, 'saveMemberPosition')
      .mockRejectedValue(new ServiceUnavailableException());
    await online(f).expect(503);
    save.mockRestore();
    expect(
      await c.prisma.providerMemberAvailabilitySession.count({
        where: { memberId: f.member.id, endedAt: null },
      }),
    ).toBe(0);
    const id = await session(f);
    jest
      .spyOn(locations, 'removeMemberPosition')
      .mockRejectedValue(new ServiceUnavailableException());
    await offline(f, id).expect(200);
    expect((await status(f)).body).toMatchObject({ data: { online: false } });
  });

  it('concurrent overlapping time-off inserts only one interval', async () => {
    const f = await fixture();
    const body = {
      startAt: new Date(Date.now() + 60_000).toISOString(),
      endAt: new Date(Date.now() + 120_000).toISOString(),
    };
    const responses = await Promise.all(
      [1, 2].map(() =>
        client()
          .post(`${self(f)}/time-offs`)
          .set('Authorization', auth(f.worker.token))
          .send(body),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('late Redis writes cannot revive offline or overwrite a newer session', async () => {
    const f = await fixture();
    const id = await session(f);
    const oldSession =
      await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
        where: { id },
      });
    await offline(f, id).expect(200);
    expect(
      await locations.saveMemberPosition({
        memberId: f.member.id,
        sessionId: id,
        version: oldSession.version,
        latitude: 21,
        longitude: 105,
        capturedAtMs: Date.now(),
      }),
    ).toBe(false);
    const currentId = await session(f);
    await locations.removeMemberPosition(f.member.id, oldSession.version);
    expect(
      await locations.getMemberPosition(f.member.id, currentId),
    ).not.toBeNull();
  });

  it('an older concurrent GPS update does not close the valid newer heartbeat session', async () => {
    const f = await fixture();
    const id = await session(f);
    const responses = await Promise.all([
      heartbeat(f, id, gps(3000)),
      heartbeat(f, id, gps(1000)),
    ]);
    expect(responses.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect((await status(f)).body).toMatchObject({
      data: { online: true, session: { id } },
    });
  });

  it('two workers of the same organization can online independently and cannot read each other’s schedule', async () => {
    const first = await fixture();
    const second = await memberCapabilitiesFixture(c, {
      owner: first.owner,
      provider: first.provider,
    });
    ids.push(second.member.id);
    const responses = await Promise.all([online(first), online(second)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await c.prisma.providerMemberAvailabilitySession.count({
        where: {
          memberId: { in: [first.member.id, second.member.id] },
          endedAt: null,
        },
      }),
    ).toBe(2);
    await client()
      .get(`${self(first)}/working-hours`)
      .set('Authorization', auth(second.worker.token))
      .expect(403);
    const firstId = (responses[0].body as StatusBody).data.session!.id;
    await offline(first, firstId).expect(200);
    expect((await status(second)).body).toMatchObject({
      data: { online: true },
    });
  });

  it('outside working hours blocks online using Vietnam local weekday', async () => {
    const f = await fixture();
    const day = vietnameseDayAndMinute(new Date()).dayOfWeek;
    await c.prisma.providerMemberWorkingHour.deleteMany({
      where: { memberId: f.member.id, dayOfWeek: day },
    });
    expect((await online(f).expect(409)).body).toMatchObject({
      code: 'OUTSIDE_WORKING_HOURS',
    });
  });

  it('Redis failure while reading status is explicitly offline without leaking financial data', async () => {
    const f = await fixture();
    await session(f);
    jest
      .spyOn(locations, 'getMemberPosition')
      .mockRejectedValue(new ServiceUnavailableException());
    expect((await status(f).expect(200)).body).toMatchObject({
      data: { online: false, locationAvailable: false },
    });
  });

  it('publish happens after SQL commit and suspension racing Redis cannot report successful online', async () => {
    const f = await fixture();
    const real = locations.saveMemberPosition.bind(locations);
    jest
      .spyOn(locations, 'saveMemberPosition')
      .mockImplementationOnce(async (position) => {
        // Would block/deadlock if the API still held its member row lock across Redis I/O.
        await c.prisma.providerMember.update({
          where: { id: f.member.id },
          data: {
            status: 'SUSPENDED',
            suspendedFromStatus: 'ACTIVE',
            suspensionSource: 'INTERNAL',
          },
        });
        return real(position);
      });
    await online(f).expect(409);
    expect((await status(f)).body).toMatchObject({ data: { online: false } });
  });

  it('a reconnect with delayed Redis failure must not close a later valid session', async () => {
    const f = await fixture();
    let fail!: () => void, started!: () => void;
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      fail = resolve;
    });
    jest
      .spyOn(locations, 'saveMemberPosition')
      .mockImplementationOnce(async () => {
        started();
        await gate;
        throw new ServiceUnavailableException();
      });
    const oldRequest = online(f).then((r) => r);
    await pending;
    const newId = await session(f);
    fail();
    expect((await oldRequest).status).toBe(503);
    expect((await status(f)).body).toMatchObject({
      data: { online: true, session: { id: newId } },
    });
  });

  it('owner can pause all members; workers cannot bypass the organization switch', async () => {
    const first = await fixture();
    const second = await memberCapabilitiesFixture(c, {
      owner: first.owner,
      provider: first.provider,
    });
    ids.push(second.member.id);
    await session(first);
    await session(second);
    const path = '/api/me/provider/member-receiving';
    await client()
      .put(path)
      .set('Authorization', auth(first.worker.token))
      .send({ enabled: false, reason: 'Tạm nghỉ toàn tổ chức.' })
      .expect(403);
    await client()
      .put(path)
      .set('Authorization', auth(first.owner.token))
      .send({ enabled: false })
      .expect(400);
    await client()
      .put(path)
      .set('Authorization', auth(first.owner.token))
      .send({ enabled: false, reason: 'Tạm nghỉ toàn tổ chức.' })
      .expect(200);
    expect(
      await c.prisma.providerMemberAvailabilitySession.count({
        where: {
          memberId: { in: [first.member.id, second.member.id] },
          endedAt: null,
        },
      }),
    ).toBe(0);
    expect((await online(first).expect(409)).body).toMatchObject({
      code: 'ORGANIZATION_PAUSED',
    });
    await client()
      .put(path)
      .set('Authorization', auth(first.owner.token))
      .send({ enabled: true, reason: 'Mở lại hoạt động tổ chức.' })
      .expect(200);
    expect((await status(second)).body).toMatchObject({
      data: { online: false },
    });
    await online(first).expect(200);
  });

  it('maintenance closes expired member sessions while preserving fresh sessions', async () => {
    const expired = await fixture(),
      fresh = await fixture();
    const oldId = await session(expired),
      freshId = await session(fresh);
    await c.prisma.providerMemberAvailabilitySession.update({
      where: { id: oldId },
      data: { lastHeartbeatAt: new Date(Date.now() - 121_000) },
    });
    await new MaintenanceService(
      c.prisma,
      new ConfigService(),
    ).closeStaleMemberSessions();
    expect(
      (
        await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
          where: { id: oldId },
        })
      ).endReason,
    ).toBe('HEARTBEAT_EXPIRED');
    expect(
      (
        await c.prisma.providerMemberAvailabilitySession.findUniqueOrThrow({
          where: { id: freshId },
        })
      ).endedAt,
    ).toBeNull();
    await heartbeat(expired, oldId).expect(409);
  });
});
