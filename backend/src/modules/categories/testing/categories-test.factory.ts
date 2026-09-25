import { ServiceCategoryStatus } from '@prisma/client';
import { CategoriesCommandService } from '../application/categories-command.service';
import { CategoriesQueryService } from '../application/categories-query.service';
import { CategoryCacheService } from '../application/category-cache.service';
import { CategoryUniquenessService } from '../application/category-uniqueness.service';
import { ChangeCategoryStatusService } from '../application/change-category-status.service';
import { CreateCategoryService } from '../application/create-category.service';
import { ReorderCategoriesService } from '../application/reorder-categories.service';
import { UpdateCategoryService } from '../application/update-category.service';

export const CATEGORY_ACTOR = {
  id: 'actor-id',
  username: 'admin',
  fullName: 'System Admin',
};

export const BASE_CATEGORY = {
  id: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
  code: 'HAIR',
  name: 'T\u00f3c',
  normalizedName: 'toc',
  slug: 'toc',
  description: null,
  iconUrl: null,
  coverImageUrl: null,
  sortOrder: 0,
  status: ServiceCategoryStatus.INACTIVE,
  createdById: CATEGORY_ACTOR.id,
  updatedById: CATEGORY_ACTOR.id,
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  updatedAt: new Date('2026-09-24T00:00:00.000Z'),
};

export const PUBLIC_CATEGORY = {
  id: BASE_CATEGORY.id,
  code: BASE_CATEGORY.code,
  name: BASE_CATEGORY.name,
  slug: BASE_CATEGORY.slug,
  description: null,
  iconUrl: null,
  coverImageUrl: null,
  sortOrder: 0,
};

export const ADMIN_CATEGORY = {
  ...PUBLIC_CATEGORY,
  status: BASE_CATEGORY.status,
  createdAt: BASE_CATEGORY.createdAt,
  updatedAt: BASE_CATEGORY.updatedAt,
  createdBy: CATEGORY_ACTOR,
  updatedBy: CATEGORY_ACTOR,
};

export function createCategoriesTestContext() {
  const serviceCategory = {
    count: jest.fn((input: unknown) => {
      void input;
      return Promise.resolve(1);
    }),
    create: jest.fn().mockResolvedValue(ADMIN_CATEGORY),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([ADMIN_CATEGORY]),
    findUnique: jest.fn().mockResolvedValue(BASE_CATEGORY),
    update: jest.fn().mockResolvedValue(ADMIN_CATEGORY),
  };
  const auditLog = {
    create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
  };
  const auditService = {
    record: jest.fn((event: object, request: object = {}): Promise<void> => {
      void auditLog.create({ data: { ...event, ...request } });
      return Promise.resolve();
    }),
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const transaction = { serviceCategory, auditLog };
  const prisma = {
    serviceCategory,
    auditLog,
    $transaction: jest.fn(
      async (
        input:
          | Promise<unknown>[]
          | ((client: typeof transaction) => Promise<unknown>),
      ) => {
        if (Array.isArray(input)) return Promise.all(input);
        return input(transaction);
      },
    ),
  };

  const categoryCache = new CategoryCacheService(cache as never);
  const uniqueness = new CategoryUniquenessService();
  const queryService = new CategoriesQueryService(
    prisma as never,
    categoryCache,
  );
  const commandService = new CategoriesCommandService(
    new CreateCategoryService(
      prisma as never,
      auditService as never,
      uniqueness,
      categoryCache,
    ),
    new UpdateCategoryService(
      prisma as never,
      auditService as never,
      uniqueness,
      categoryCache,
    ),
    new ChangeCategoryStatusService(
      prisma as never,
      auditService as never,
      categoryCache,
    ),
    new ReorderCategoriesService(
      prisma as never,
      auditService as never,
      categoryCache,
    ),
  );

  return {
    queryService,
    commandService,
    serviceCategory,
    auditLog,
    cache,
  };
}
