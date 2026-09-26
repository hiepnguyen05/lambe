import { ServiceCategoryStatus, ServiceStatus } from '@prisma/client';
import { ChangeServiceStatusService } from '../application/change-service-status.service';
import { CreateServiceService } from '../application/create-service.service';
import { ReorderServicesService } from '../application/reorder-services.service';
import { ServiceCacheService } from '../application/service-cache.service';
import { ServiceImageService } from '../application/service-image.service';
import { ServiceUniquenessService } from '../application/service-uniqueness.service';
import { ServicesCommandService } from '../application/services-command.service';
import { ServicesQueryService } from '../application/services-query.service';
import { UpdateServiceService } from '../application/update-service.service';

export const SERVICE_ACTOR = {
  id: '5b409f7f-37e9-4f03-9bb2-2ae5a426e2cd',
  username: 'admin',
  fullName: 'System Admin',
};

export const SERVICE_CATEGORY = {
  id: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
  code: 'HAIR',
  name: 'Tóc',
  slug: 'toc',
  status: ServiceCategoryStatus.ACTIVE,
};

export const BASE_SERVICE = {
  id: '4eb236b4-959d-45b9-a3f0-1f9c8c11f5e7',
  categoryId: SERVICE_CATEGORY.id,
  code: 'MEN_HAIRCUT',
  name: 'Cắt tóc nam',
  normalizedName: 'cat toc nam',
  slug: 'cat-toc-nam',
  description: null,
  iconUrl: 'content_cut',
  coverImageUrl: null,
  coverImagePublicId: null,
  minPriceAmount: 50000,
  maxPriceAmount: 300000,
  currencyCode: 'VND',
  defaultDurationMinutes: 45,
  sortOrder: 0,
  status: ServiceStatus.INACTIVE,
  createdById: SERVICE_ACTOR.id,
  updatedById: SERVICE_ACTOR.id,
  createdAt: new Date('2026-09-25T00:00:00.000Z'),
  updatedAt: new Date('2026-09-25T00:00:00.000Z'),
};

export const ADMIN_SERVICE = {
  id: BASE_SERVICE.id,
  categoryId: BASE_SERVICE.categoryId,
  code: BASE_SERVICE.code,
  name: BASE_SERVICE.name,
  slug: BASE_SERVICE.slug,
  description: BASE_SERVICE.description,
  iconUrl: BASE_SERVICE.iconUrl,
  coverImageUrl: BASE_SERVICE.coverImageUrl,
  minPriceAmount: BASE_SERVICE.minPriceAmount,
  maxPriceAmount: BASE_SERVICE.maxPriceAmount,
  currencyCode: BASE_SERVICE.currencyCode,
  defaultDurationMinutes: BASE_SERVICE.defaultDurationMinutes,
  sortOrder: BASE_SERVICE.sortOrder,
  status: BASE_SERVICE.status,
  createdAt: BASE_SERVICE.createdAt,
  updatedAt: BASE_SERVICE.updatedAt,
  category: SERVICE_CATEGORY,
  createdBy: SERVICE_ACTOR,
  updatedBy: SERVICE_ACTOR,
};

export const PUBLIC_SERVICE = {
  id: BASE_SERVICE.id,
  code: BASE_SERVICE.code,
  name: BASE_SERVICE.name,
  slug: BASE_SERVICE.slug,
  description: BASE_SERVICE.description,
  iconUrl: BASE_SERVICE.iconUrl,
  coverImageUrl: BASE_SERVICE.coverImageUrl,
  minPriceAmount: BASE_SERVICE.minPriceAmount,
  maxPriceAmount: BASE_SERVICE.maxPriceAmount,
  currencyCode: BASE_SERVICE.currencyCode,
  defaultDurationMinutes: BASE_SERVICE.defaultDurationMinutes,
  sortOrder: BASE_SERVICE.sortOrder,
  category: {
    id: SERVICE_CATEGORY.id,
    code: SERVICE_CATEGORY.code,
    name: SERVICE_CATEGORY.name,
    slug: SERVICE_CATEGORY.slug,
  },
};

export function createServicesTestContext() {
  const service = {
    count: jest.fn().mockResolvedValue(1),
    create: jest.fn().mockResolvedValue(ADMIN_SERVICE),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([ADMIN_SERVICE]),
    findUnique: jest.fn().mockResolvedValue(BASE_SERVICE),
    findUniqueOrThrow: jest.fn().mockResolvedValue(ADMIN_SERVICE),
    update: jest.fn().mockResolvedValue(ADMIN_SERVICE),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const serviceCategory = {
    findUnique: jest.fn().mockResolvedValue(SERVICE_CATEGORY),
  };
  const auditLog = { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
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
  const mediaStorage = {
    uploadImage: jest.fn().mockResolvedValue({
      url: 'http://example.test/service.webp',
      secureUrl: 'https://example.test/service.webp',
      publicId: 'lambe/services/service-id/cover',
      format: 'webp',
      resourceType: 'image',
    }),
    deleteImage: jest.fn().mockResolvedValue(true),
  };
  const transaction = { service, serviceCategory, auditLog };
  const prisma = {
    service,
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

  const serviceCache = new ServiceCacheService(cache as never);
  const uniqueness = new ServiceUniquenessService();
  const queryService = new ServicesQueryService(prisma as never, serviceCache);
  const commandService = new ServicesCommandService(
    new CreateServiceService(
      prisma as never,
      auditService as never,
      uniqueness,
      serviceCache,
    ),
    new UpdateServiceService(
      prisma as never,
      auditService as never,
      uniqueness,
      serviceCache,
    ),
    new ChangeServiceStatusService(
      prisma as never,
      auditService as never,
      serviceCache,
    ),
    new ReorderServicesService(
      prisma as never,
      auditService as never,
      serviceCache,
    ),
  );
  const imageService = new ServiceImageService(
    prisma as never,
    auditService as never,
    serviceCache,
    mediaStorage,
  );

  return {
    queryService,
    commandService,
    imageService,
    service,
    serviceCategory,
    auditLog,
    cache,
    mediaStorage,
  };
}
