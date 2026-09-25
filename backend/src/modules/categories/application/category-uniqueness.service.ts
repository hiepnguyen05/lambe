import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface UniqueCategoryInput {
  code?: string;
  normalizedName?: string;
  slug?: string;
}

@Injectable()
export class CategoryUniquenessService {
  async assertAvailable(
    transaction: Prisma.TransactionClient,
    input: UniqueCategoryInput,
    excludedId?: string,
  ): Promise<void> {
    const conditions: Prisma.ServiceCategoryWhereInput[] = [];

    if (input.code) conditions.push({ code: input.code });
    if (input.normalizedName) {
      conditions.push({ normalizedName: input.normalizedName });
    }
    if (input.slug) conditions.push({ slug: input.slug });
    if (conditions.length === 0) return;

    const existing = await transaction.serviceCategory.findFirst({
      where: {
        OR: conditions,
        ...(excludedId ? { NOT: { id: excludedId } } : {}),
      },
    });

    if (!existing) return;
    if (input.code && existing.code === input.code) {
      throw new ConflictException(`Mã danh mục '${input.code}' đã tồn tại.`);
    }
    if (input.slug && existing.slug === input.slug) {
      throw new ConflictException(`Slug '${input.slug}' đã được sử dụng.`);
    }
    throw new ConflictException('Tên danh mục đã tồn tại.');
  }
}

export function rethrowCategoryWriteError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(
      'Mã, tên hoặc slug của danh mục đã được sử dụng.',
    );
  }

  throw error;
}
