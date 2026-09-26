import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface UniqueServiceInput {
  categoryId: string;
  code?: string;
  normalizedName?: string;
  slug?: string;
}

@Injectable()
export class ServiceUniquenessService {
  async assertAvailable(
    transaction: Prisma.TransactionClient,
    input: UniqueServiceInput,
    excludedId?: string,
  ): Promise<void> {
    const conditions: Prisma.ServiceWhereInput[] = [];
    if (input.code) conditions.push({ code: input.code });
    if (input.slug) conditions.push({ slug: input.slug });
    if (input.normalizedName) {
      conditions.push({
        categoryId: input.categoryId,
        normalizedName: input.normalizedName,
      });
    }
    if (conditions.length === 0) return;

    const existing = await transaction.service.findFirst({
      where: {
        OR: conditions,
        ...(excludedId ? { NOT: { id: excludedId } } : {}),
      },
    });

    if (!existing) return;
    if (input.code && existing.code === input.code) {
      throw new ConflictException(`Mã dịch vụ '${input.code}' đã tồn tại.`);
    }
    if (input.slug && existing.slug === input.slug) {
      throw new ConflictException(`Slug '${input.slug}' đã được sử dụng.`);
    }
    throw new ConflictException('Tên dịch vụ đã tồn tại trong danh mục.');
  }
}

export function rethrowServiceWriteError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(
      'Mã, tên hoặc slug của dịch vụ đã được sử dụng.',
    );
  }
  throw error;
}
