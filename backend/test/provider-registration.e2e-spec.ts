import * as argon2 from 'argon2';
import { randomInt, randomUUID } from 'crypto';
import request from 'supertest';
import {
  InternalRole,
  ProviderApplicationSection,
  ProviderDocumentType,
} from '@prisma/client';
import { KycCryptoService } from '../src/modules/provider-applications/application/kyc/kyc-crypto.service';
import { ARGON2_OPTIONS } from '../src/modules/internal-auth/constants/password.constants';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('Provider registration upgrade (e2e)', () => {
  let context: TestAppContext;
  const marker = `prov-e2e-${randomUUID().slice(0, 8)}`;
  const phone = `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
  const nationalId = `999999${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
  let userId: string;
  let accessToken: string;
  let applicationId: string;
  let serviceId: string;
  let itemId: string;
  let documentId: string;
  let categoryId: string;
  const internalTokens: Partial<Record<InternalRole, string>> = {};

  beforeAll(async () => {
    context = await createTestApp();
    const user = await context.prisma.user.create({
      data: {
        phone,
        fullName: marker,
        firebaseUid: marker,
        roles: { create: { role: 'CUSTOMER' } },
      },
    });
    userId = user.id;
    context.setVerifiedIdentity({
      uid: marker,
      signInProvider: 'phone',
      phoneNumber: `+84${phone.slice(1)}`,
    });
    const login = await request(context.app.getHttpServer())
      .post('/api/auth/firebase')
      .send({ idToken: 'x'.repeat(100) })
      .expect(200);
    accessToken = (login.body as { data: { accessToken: string } }).data
      .accessToken;
    const category = await context.prisma.serviceCategory.create({
      data: {
        code: marker.replace(/-/g, '_').toUpperCase(),
        name: marker,
        normalizedName: marker,
        slug: marker,
        status: 'ACTIVE',
      },
    });
    categoryId = category.id;
    const service = await context.prisma.service.create({
      data: {
        categoryId,
        code: `${marker.replace(/-/g, '_').toUpperCase()}_SERVICE`,
        name: marker,
        normalizedName: marker,
        slug: `${marker}-service`,
        status: 'ACTIVE',
        targetAudience: 'MEN',
        minPriceAmount: 50_000,
        maxPriceAmount: 300_000,
        requiresCertificate: true,
        minPortfolioImages: 1,
        minExperienceYears: 2,
      },
    });
    serviceId = service.id;
    for (const role of [
      InternalRole.ADMIN,
      InternalRole.KYC_REVIEWER,
      InternalRole.MODERATOR,
      InternalRole.SERVICE_REVIEWER,
      InternalRole.SUPPORT,
    ]) {
      const username = `${marker}-${role}`;
      await context.prisma.internalAccount.create({
        data: {
          username,
          normalizedUsername: username.toLowerCase(),
          fullName: marker,
          status: 'ACTIVE',
          mustChangePassword: false,
          credential: {
            create: {
              passwordHash: await argon2.hash(
                'E2E-password-secure-2026',
                ARGON2_OPTIONS,
              ),
            },
          },
          roles: { create: { role } },
        },
      });
      const response = await request(context.app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username, password: 'E2E-password-secure-2026' })
        .expect(200);
      internalTokens[role] = (
        response.body as { data: { accessToken: string } }
      ).data.accessToken;
    }
  }, 30_000);

  afterAll(async () => {
    if (context) {
      try {
        await context.prisma.mailOutbox.deleteMany({
          where: {
            OR: [
              { deduplicationKey: { contains: applicationId ?? marker } },
              { recipient: `${marker}@example.com` },
            ],
          },
        });
        if (userId) {
          await context.prisma.providerService.deleteMany({
            where: { provider: { userId } },
          });
          await context.prisma.providerWallet.deleteMany({
            where: { provider: { userId } },
          });
          await context.prisma.providerProfile.deleteMany({
            where: { userId },
          });
          await context.prisma.providerApplication.deleteMany({
            where: { userId },
          });
          await context.prisma.providerIdentityClaim.deleteMany({
            where: { userId },
          });
          await context.prisma.user.delete({ where: { id: userId } });
        }
        if (serviceId)
          await context.prisma.service.delete({ where: { id: serviceId } });
        if (categoryId)
          await context.prisma.serviceCategory.delete({
            where: { id: categoryId },
          });
        await context.prisma.internalAccount.deleteMany({
          where: { fullName: marker },
        });
        await context.prisma.auditLog.deleteMany({
          where: {
            OR: [
              { resourceId: applicationId ?? marker },
              { metadata: { path: ['username'], string_starts_with: marker } },
            ],
          },
        });
      } finally {
        await context.app.close();
      }
    }
  });

  const userRequest = () => request(context.app.getHttpServer());
  const userHeader = () => `Bearer ${accessToken}`;
  const internalHeader = (role: InternalRole) =>
    `Bearer ${internalTokens[role] ?? ''}`;

  it('rejects invalid date/null required values and requires verified email and service-linked evidence', async () => {
    const create = await userRequest()
      .post('/api/provider-applications')
      .set('Authorization', userHeader())
      .send({ providerType: 'INDIVIDUAL' })
      .expect(201);
    applicationId = (create.body as { data: { id: string } }).data.id;
    await userRequest()
      .patch(`/api/provider-applications/${applicationId}`)
      .set('Authorization', userHeader())
      .send({ birthDate: '1995-02-30' })
      .expect(400);
    await userRequest()
      .patch(`/api/provider-applications/${applicationId}`)
      .set('Authorization', userHeader())
      .send({
        legalFullName: 'Provider Test',
        birthDate: '1995-08-20',
        nationalIdNumber: nationalId,
        email: `${marker}@example.com`,
        experienceYears: 3,
      })
      .expect(200);
    const service = await userRequest()
      .post(`/api/provider-applications/${applicationId}/services`)
      .set('Authorization', userHeader())
      .send({ serviceId, proposedPriceAmount: 150_000 })
      .expect(201);
    itemId = (service.body as { data: { id: string } }).data.id;
    await userRequest()
      .patch(`/api/provider-applications/${applicationId}/services/${itemId}`)
      .set('Authorization', userHeader())
      .send({ serviceId: null })
      .expect(400);
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/submit`)
      .set('Authorization', userHeader())
      .expect(400);
    // Synthetic protected storage metadata; no real KYC assets or external uploads in tests.
    for (const type of [
      ProviderDocumentType.PORTRAIT,
      ProviderDocumentType.ID_CARD_FRONT,
      ProviderDocumentType.ID_CARD_BACK,
      ProviderDocumentType.IDENTITY_SELFIE,
      ProviderDocumentType.PROFESSIONAL_CERTIFICATE,
      ProviderDocumentType.PORTFOLIO,
    ]) {
      const document = await context.prisma.providerApplicationDocument.create({
        data: {
          applicationId,
          type,
          applicationServiceId: [
            ProviderDocumentType.PROFESSIONAL_CERTIFICATE,
            ProviderDocumentType.PORTFOLIO,
          ].some((value) => value === type)
            ? itemId
            : null,
          fileUrl: 'https://example.test/private.webp',
          publicId: `${marker}/${type}`,
          fileFormat: 'webp',
          deliveryType: 'authenticated',
        },
      });
      documentId = document.id;
    }
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/terms/accept`)
      .set('Authorization', userHeader())
      .send({ accepted: true })
      .expect(200);
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/submit`)
      .set('Authorization', userHeader())
      .expect(400);
  });

  it('verifies the contact email, rejects wrong codes and does not trust body-supplied verification flags', async () => {
    await userRequest()
      .patch(`/api/provider-applications/${applicationId}`)
      .set('Authorization', userHeader())
      .send({ emailVerifiedAt: new Date().toISOString() })
      .expect(400);
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/email/request-code`)
      .set('Authorization', userHeader())
      .expect(200);
    const pending = await context.prisma.mailOutbox.findFirstOrThrow({
      where: {
        deduplicationKey: { startsWith: `provider-email:${applicationId}:` },
      },
      orderBy: { createdAt: 'desc' },
    });
    const code = pending.text.match(/\b\d{6}\b/)?.[0];
    expect(code).toBeDefined();
    const wrongCode = code === '000000' ? '999999' : '000000';
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/email/verify`)
      .set('Authorization', userHeader())
      .send({ code: wrongCode })
      .expect(400);
    expect(
      (
        await context.prisma.providerApplicationEmailVerification.findUniqueOrThrow(
          { where: { applicationId } },
        )
      ).attempts,
    ).toBe(1);
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/email/verify`)
      .set('Authorization', userHeader())
      .send({ code })
      .expect(200);
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/email/verify`)
      .set('Authorization', userHeader())
      .send({ code })
      .expect(400);
    await userRequest()
      .post(`/api/provider-applications/${applicationId}/submit`)
      .set('Authorization', userHeader())
      .expect(200);
  });

  it('restricts KYC, final approval and document access by internal role', async () => {
    await userRequest()
      .get(
        `/api/admin/provider-applications/${applicationId}/documents/${documentId}/access`,
      )
      .expect(401);
    await userRequest()
      .get(
        `/api/admin/provider-applications/${applicationId}/documents/${documentId}/access`,
      )
      .set('Authorization', internalHeader(InternalRole.MODERATOR))
      .expect(200);
    await userRequest()
      .post(`/api/admin/provider-applications/${applicationId}/approve`)
      .set('Authorization', internalHeader(InternalRole.SUPPORT))
      .expect(403);
    await userRequest()
      .post(`/api/admin/provider-applications/${applicationId}/approve`)
      .set('Authorization', internalHeader(InternalRole.SERVICE_REVIEWER))
      .expect(403);
    await userRequest()
      .post(`/api/admin/provider-applications/${applicationId}/approve`)
      .set('Authorization', internalHeader(InternalRole.MODERATOR))
      .expect(400);
    await userRequest()
      .patch(
        `/api/admin/provider-applications/${applicationId}/checks/IDENTITY`,
      )
      .set('Authorization', internalHeader(InternalRole.MODERATOR))
      .send({ status: 'VERIFIED' })
      .expect(200);
    const support = await userRequest()
      .get(`/api/admin/provider-applications/${applicationId}`)
      .set('Authorization', internalHeader(InternalRole.SUPPORT))
      .expect(200);
    const safe = (support.body as { data: Record<string, unknown> }).data;
    expect(safe).not.toHaveProperty('nationalIdNumber');
    expect(safe).not.toHaveProperty('nationalIdEncrypted');
    expect(safe).not.toHaveProperty('birthDate');
    expect(safe).not.toHaveProperty('documents');
    const detail = await userRequest()
      .get(`/api/admin/provider-applications/${applicationId}`)
      .set('Authorization', internalHeader(InternalRole.KYC_REVIEWER))
      .expect(200);
    expect(
      (detail.body as { data: { nationalIdNumber: string } }).data
        .nationalIdNumber,
    ).toBe(nationalId);
    expect(JSON.stringify(detail.body)).not.toContain('nationalIdEncrypted');
  });

  it('revalidates catalogue availability and price at approval, and prevents double approval', async () => {
    const docs = await context.prisma.providerApplicationDocument.findMany({
      where: { applicationId },
    });
    for (const doc of docs)
      await userRequest()
        .patch(
          `/api/admin/provider-applications/${applicationId}/documents/${doc.id}/review`,
        )
        .set('Authorization', internalHeader(InternalRole.MODERATOR))
        .send({ status: 'VERIFIED' })
        .expect(200);
    await userRequest()
      .patch(
        `/api/admin/provider-applications/${applicationId}/services/${itemId}/review`,
      )
      .set('Authorization', internalHeader(InternalRole.MODERATOR))
      .send({ status: 'VERIFIED' })
      .expect(200);
    for (const section of Object.values(ProviderApplicationSection))
      await userRequest()
        .patch(
          `/api/admin/provider-applications/${applicationId}/checks/${section}`,
        )
        .set('Authorization', internalHeader(InternalRole.MODERATOR))
        .send({ status: 'VERIFIED' })
        .expect(200);
    await context.prisma.service.update({
      where: { id: serviceId },
      data: { status: 'INACTIVE' },
    });
    await userRequest()
      .post(`/api/admin/provider-applications/${applicationId}/approve`)
      .set('Authorization', internalHeader(InternalRole.ADMIN))
      .expect(400);
    await context.prisma.service.update({
      where: { id: serviceId },
      data: { status: 'ACTIVE', minPriceAmount: 200_000 },
    });
    await userRequest()
      .post(`/api/admin/provider-applications/${applicationId}/approve`)
      .set('Authorization', internalHeader(InternalRole.ADMIN))
      .expect(400);
    await context.prisma.service.update({
      where: { id: serviceId },
      data: { minPriceAmount: 50_000 },
    });
    const results = await Promise.all(
      [InternalRole.MODERATOR, InternalRole.KYC_REVIEWER].map((role) =>
        userRequest()
          .post(`/api/admin/provider-applications/${applicationId}/approve`)
          .set('Authorization', internalHeader(role)),
      ),
    );
    expect(results.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      await context.prisma.providerProfile.count({ where: { userId } }),
    ).toBe(1);
    expect(
      await context.prisma.mailOutbox.count({
        where: { deduplicationKey: `provider:${applicationId}:1:approved` },
      }),
    ).toBe(1);
    const application =
      await context.prisma.providerApplication.findUniqueOrThrow({
        where: { id: applicationId },
      });
    const reviewer = await context.prisma.internalAccount.findUniqueOrThrow({
      where: { id: application.reviewedById ?? '' },
      include: { roles: true },
    });
    expect(
      reviewer.roles.some(
        ({ role }) =>
          role === InternalRole.MODERATOR || role === InternalRole.KYC_REVIEWER,
      ),
    ).toBe(true);
    expect(reviewer.roles.some(({ role }) => role === InternalRole.ADMIN)).toBe(
      false,
    );
    await userRequest()
      .patch(`/api/provider-applications/${applicationId}`)
      .set('Authorization', userHeader())
      .send({ biography: 'Cannot edit approved' })
      .expect(409);
  });

  it('sets up an approved provider without turning on job acceptance or bypassing suspension', async () => {
    const providerService =
      await context.prisma.providerService.findFirstOrThrow({
        where: { provider: { userId } },
      });
    const setup = {
      serviceAreaName: 'Cau Giay, Ha Noi',
      serviceRadiusKm: 10,
      enabledServiceIds: [providerService.id],
      workingHours: [{ dayOfWeek: 1, startMinute: 480, endMinute: 1020 }],
    };
    await userRequest()
      .put('/api/me/provider/setup')
      .set('Authorization', userHeader())
      .send({
        ...setup,
        workingHours: [{ dayOfWeek: 1, startMinute: 1020, endMinute: 480 }],
      })
      .expect(400);
    await userRequest()
      .put('/api/me/provider/setup')
      .set('Authorization', userHeader())
      .send(setup)
      .expect(200);
    const provider = await context.prisma.providerProfile.findUniqueOrThrow({
      where: { userId },
    });
    expect(provider.status).toBe('ACTIVE');
    expect(provider.serviceRadiusKm).toBe(10);
    await context.prisma.providerProfile.update({
      where: { userId },
      data: { status: 'SUSPENDED' },
    });
    await userRequest()
      .put('/api/me/provider/setup')
      .set('Authorization', userHeader())
      .send(setup)
      .expect(403);
    expect(
      (
        await context.prisma.providerProfile.findUniqueOrThrow({
          where: { userId },
        })
      ).status,
    ).toBe('SUSPENDED');
  });

  it.each([InternalRole.MODERATOR, InternalRole.KYC_REVIEWER])(
    'allows %s to reject a pending application directly with audit and email queued',
    async (role) => {
      const owner = await context.prisma.user.create({
        data: {
          phone: `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`,
          fullName: marker,
        },
      });
      const application = await context.prisma.providerApplication.create({
        data: {
          userId: owner.id,
          providerType: 'INDIVIDUAL',
          status: 'PENDING_REVIEW',
          revisionNumber: 1,
          email: `${marker}@example.com`,
        },
      });
      const requestId = `reviewer-reject-${application.id}`;
      try {
        await userRequest()
          .post(`/api/admin/provider-applications/${application.id}/reject`)
          .set('Authorization', internalHeader(InternalRole.SUPPORT))
          .send({ reason: 'Invalid identity documents' })
          .expect(403);
        await userRequest()
          .post(`/api/admin/provider-applications/${application.id}/reject`)
          .set('Authorization', internalHeader(InternalRole.SERVICE_REVIEWER))
          .send({ reason: 'Invalid identity documents' })
          .expect(403);
        await userRequest()
          .post(`/api/admin/provider-applications/${application.id}/reject`)
          .set('Authorization', internalHeader(role))
          .set('x-request-id', requestId)
          .send({ reason: 'Invalid identity documents' })
          .expect(200);
        const rejected =
          await context.prisma.providerApplication.findUniqueOrThrow({
            where: { id: application.id },
          });
        expect(rejected.status).toBe('REJECTED');
        expect(
          await context.prisma.auditLog.findFirst({
            where: {
              resourceId: application.id,
              action: 'PROVIDER_APPLICATION_REJECTED',
              requestId,
            },
          }),
        ).toMatchObject({ actorInternalAccountId: rejected.reviewedById });
        expect(
          await context.prisma.mailOutbox.count({
            where: {
              deduplicationKey: `provider:${application.id}:1:rejected`,
            },
          }),
        ).toBe(1);
        await userRequest()
          .post(`/api/admin/provider-applications/${application.id}/approve`)
          .set('Authorization', internalHeader(role))
          .expect(409);
      } finally {
        await context.prisma.mailOutbox.deleteMany({
          where: { deduplicationKey: `provider:${application.id}:1:rejected` },
        });
        await context.prisma.auditLog.deleteMany({
          where: { resourceId: application.id },
        });
        await context.prisma.providerApplication.delete({
          where: { id: application.id },
        });
        await context.prisma.user.delete({ where: { id: owner.id } });
      }
    },
  );

  it('reserves identity ownership across withdrawn applications but permits the same account to reapply', async () => {
    const identity = context.app
      .get(KycCryptoService)
      .protectNationalId(
        `999998${randomInt(0, 1_000_000).toString().padStart(6, '0')}`,
      );
    const owner = await context.prisma.user.create({
      data: {
        phone: `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`,
        fullName: marker,
      },
    });
    const app = await context.prisma.providerApplication.create({
      data: {
        userId: owner.id,
        providerType: 'INDIVIDUAL',
        status: 'WITHDRAWN',
        nationalIdEncrypted: identity.encrypted,
        nationalIdHash: identity.hash,
        nationalIdLast4: identity.last4,
      },
    });
    await context.prisma.providerIdentityClaim.create({
      data: { userId: owner.id, nationalIdHash: identity.hash },
    });
    await expect(
      context.prisma.providerApplication.create({
        data: {
          userId: owner.id,
          providerType: 'INDIVIDUAL',
          nationalIdEncrypted: identity.encrypted,
          nationalIdHash: identity.hash,
          nationalIdLast4: identity.last4,
        },
      }),
    ).resolves.toHaveProperty('status', 'DRAFT');
    await context.prisma.providerApplication.deleteMany({
      where: { userId: owner.id },
    });
    await context.prisma.providerIdentityClaim.delete({
      where: { nationalIdHash: identity.hash },
    });
    await context.prisma.user.delete({ where: { id: owner.id } });
    expect(app.status).toBe('WITHDRAWN');
  });
});
