import { Prisma } from '@prisma/client';

const actorSelect = {
  id: true,
  username: true,
  fullName: true,
} satisfies Prisma.InternalAccountSelect;

export const adminCategorySelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  iconUrl: true,
  coverImageUrl: true,
  sortOrder: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: actorSelect },
  updatedBy: { select: actorSelect },
} satisfies Prisma.ServiceCategorySelect;

export const publicCategorySelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  description: true,
  iconUrl: true,
  coverImageUrl: true,
  sortOrder: true,
} satisfies Prisma.ServiceCategorySelect;

export interface CategorySnapshotSource {
  code: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  coverImageUrl: string | null;
  sortOrder: number;
  status: string;
}

export function toCategoryAuditSnapshot(category: CategorySnapshotSource) {
  return {
    code: category.code,
    name: category.name,
    slug: category.slug,
    description: category.description,
    iconUrl: category.iconUrl,
    coverImageUrl: category.coverImageUrl,
    sortOrder: category.sortOrder,
    status: category.status,
  };
}
