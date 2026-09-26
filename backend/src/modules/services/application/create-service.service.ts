import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceCategoryStatus, ServiceStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { CreateServiceDto } from '../dto/create-service.dto';
import {
  normalizeServiceName,
  trimOptionalServiceField,
} from '../domain/service-normalizer';
import { assertValidPriceRange } from '../domain/service-status.policy';
import { adminServiceSelect, toServiceAuditSnapshot } from './service.select';
import { ServiceCacheService } from './service-cache.service';
import {
  rethrowServiceWriteError,
  ServiceUniquenessService,
} from './service-uniqueness.service';

@Injectable()
export class CreateServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly uniqueness: ServiceUniquenessService,
    private readonly cache: ServiceCacheService,
  ) {}

  async execute(
    dto: CreateServiceDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    assertValidPriceRange(dto.minPriceAmount, dto.maxPriceAmount);
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const normalizedName = normalizeServiceName(name);
    const slug = dto.slug.trim().toLowerCase();

    try {
      const service = await this.prisma.$transaction(async (transaction) => {
        const category = await transaction.serviceCategory.findUnique({
          where: { id: dto.categoryId },
          select: { status: true },
        });
        if (!category) {
          throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
        }
        if (category.status === ServiceCategoryStatus.ARCHIVED) {
          throw new BadRequestException(
            'Không thể tạo dịch vụ trong danh mục đã lưu trữ.',
          );
        }

        await this.uniqueness.assertAvailable(transaction, {
          categoryId: dto.categoryId,
          code,
          normalizedName,
          slug,
        });
        const created = await transaction.service.create({
          data: {
            categoryId: dto.categoryId,
            code,
            name,
            normalizedName,
            slug,
            description: trimOptionalServiceField(dto.description),
            iconUrl: trimOptionalServiceField(dto.iconUrl),
            minPriceAmount: dto.minPriceAmount,
            maxPriceAmount: dto.maxPriceAmount,
            currencyCode: 'VND',
            defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
            sortOrder: dto.sortOrder ?? 0,
            status: ServiceStatus.INACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
          select: adminServiceSelect,
        });
        await this.auditService.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_CREATED',
            resourceType: 'Service',
            resourceId: created.id,
            result: 'SUCCESS',
            metadata: { after: toServiceAuditSnapshot(created) },
          },
          request,
          transaction,
        );
        return created;
      });

      await this.cache.invalidateActive();
      return {
        success: true,
        message: 'Tạo dịch vụ thành công.',
        data: service,
      };
    } catch (error: unknown) {
      rethrowServiceWriteError(error);
    }
  }
}
