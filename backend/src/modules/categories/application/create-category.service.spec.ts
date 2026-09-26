import { ConflictException } from '@nestjs/common';
import { Prisma, ServiceCategoryStatus } from '@prisma/client';
import {
  ADMIN_CATEGORY,
  BASE_CATEGORY,
  CATEGORY_ACTOR,
  createCategoriesTestContext,
} from '../testing/categories-test.factory';

describe('CreateCategoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an inactive normalized category and writes an audit log', async () => {
    const { commandService, serviceCategory, auditLog, cache } =
      createCategoriesTestContext();

    await expect(
      commandService.create(
        {
          code: ' hair ',
          name: '  T\u00f3c  ',
          slug: ' TOC ',
          description: ' Ch\u0103m s\u00f3c t\u00f3c ',
          sortOrder: 2,
        },
        CATEGORY_ACTOR.id,
        { ipAddress: '127.0.0.1', userAgent: 'jest' },
      ),
    ).resolves.toMatchObject({ success: true, data: ADMIN_CATEGORY });

    expect(serviceCategory.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ code: 'HAIR' }, { normalizedName: 'toc' }, { slug: 'toc' }],
      },
    });
    expect(serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'HAIR',
          name: 'T\u00f3c',
          normalizedName: 'toc',
          slug: 'toc',
          description: 'Ch\u0103m s\u00f3c t\u00f3c',
          status: ServiceCategoryStatus.INACTIVE,
        }) as object,
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SERVICE_CATEGORY_CREATED',
        actorInternalAccountId: CATEGORY_ACTOR.id,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      }) as object,
    });
    expect(cache.delete).toHaveBeenCalledWith('service-categories:active:v1');
    expect(cache.delete).toHaveBeenCalledWith('services:active:v1');
  });

  it.each([
    ['code', { ...BASE_CATEGORY, code: 'HAIR' }, 'M\u00e3 danh m\u1ee5c'],
    ['slug', { ...BASE_CATEGORY, code: 'OTHER', slug: 'toc' }, 'Slug'],
    [
      'name',
      { ...BASE_CATEGORY, code: 'OTHER', slug: 'other' },
      'T\u00ean danh m\u1ee5c',
    ],
  ])('rejects a duplicate %s', async (_field, existing, message) => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findFirst.mockResolvedValue(existing);

    await expect(
      commandService.create(
        { code: 'HAIR', name: 'T\u00f3c', slug: 'toc' },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toThrow(message);
  });

  it('maps a unique constraint race to conflict', async () => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate category', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      commandService.create(
        { code: 'HAIR', name: 'T\u00f3c', slug: 'toc' },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not hide unexpected create errors', async () => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.create.mockRejectedValue(new Error('database offline'));

    await expect(
      commandService.create(
        { code: 'HAIR', name: 'T\u00f3c', slug: 'toc' },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toThrow('database offline');
  });
});
