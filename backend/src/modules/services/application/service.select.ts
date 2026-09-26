import { Prisma } from '@prisma/client';

const actorSelect = {
  id: true,
  username: true,
  fullName: true,
} satisfies Prisma.InternalAccountSelect;

const categorySummarySelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.ServiceCategorySelect;

export const adminServiceSelect = {
  id: true,
  categoryId: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  iconUrl: true,
  coverImageUrl: true,
  minPriceAmount: true,
  maxPriceAmount: true,
  currencyCode: true,
  defaultDurationMinutes: true,
  sortOrder: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: categorySummarySelect },
  createdBy: { select: actorSelect },
  updatedBy: { select: actorSelect },
} satisfies Prisma.ServiceSelect;

export const publicServiceSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  iconUrl: true,
  coverImageUrl: true,
  minPriceAmount: true,
  maxPriceAmount: true,
  currencyCode: true,
  defaultDurationMinutes: true,
  sortOrder: true,
  category: {
    select: { id: true, code: true, name: true, slug: true },
  },
} satisfies Prisma.ServiceSelect;

export interface ServiceSnapshotSource {
  categoryId: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  coverImageUrl: string | null;
  minPriceAmount: number;
  maxPriceAmount: number;
  currencyCode: string;
  defaultDurationMinutes: number | null;
  sortOrder: number;
  status: string;
}

export function toServiceAuditSnapshot(service: ServiceSnapshotSource) {
  return {
    categoryId: service.categoryId,
    code: service.code,
    name: service.name,
    slug: service.slug,
    description: service.description,
    iconUrl: service.iconUrl,
    coverImageUrl: service.coverImageUrl,
    minPriceAmount: service.minPriceAmount,
    maxPriceAmount: service.maxPriceAmount,
    currencyCode: service.currencyCode,
    defaultDurationMinutes: service.defaultDurationMinutes,
    sortOrder: service.sortOrder,
    status: service.status,
  };
}
