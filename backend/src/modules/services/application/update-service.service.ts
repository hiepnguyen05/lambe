import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { UpdateServiceDto } from '../dto/update-service.dto';
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
export class UpdateServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly uniqueness: ServiceUniquenessService,
    private readonly cache: ServiceCacheService,
  ) {}

  async execute(
    id: string,
    dto: UpdateServiceDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để sửa.');
    }

    try {
      const service = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.service.findUnique({
          where: { id },
        });
        if (!existing) throw new NotFoundException('Không tìm thấy dịch vụ.');

        const minPriceAmount = dto.minPriceAmount ?? existing.minPriceAmount;
        const maxPriceAmount = dto.maxPriceAmount ?? existing.maxPriceAmount;
        assertValidPriceRange(minPriceAmount, maxPriceAmount);

        const updates: Prisma.ServiceUncheckedUpdateInput = {
          updatedById: actorId,
        };
        const uniqueInput: {
          categoryId: string;
          normalizedName?: string;
          slug?: string;
        } = { categoryId: existing.categoryId };

        if (dto.name !== undefined) {
          updates.name = dto.name.trim();
          updates.normalizedName = normalizeServiceName(dto.name);
          uniqueInput.normalizedName = updates.normalizedName;
        }
        if (dto.slug !== undefined) {
          updates.slug = dto.slug.trim().toLowerCase();
          uniqueInput.slug = updates.slug;
        }
        if (dto.description !== undefined) {
          updates.description = trimOptionalServiceField(dto.description);
        }
        if (dto.iconUrl !== undefined) {
          updates.iconUrl = trimOptionalServiceField(dto.iconUrl);
        }
        if (dto.minPriceAmount !== undefined) {
          updates.minPriceAmount = dto.minPriceAmount;
        }
        if (dto.maxPriceAmount !== undefined) {
          updates.maxPriceAmount = dto.maxPriceAmount;
        }
        if (dto.defaultDurationMinutes !== undefined) {
          updates.defaultDurationMinutes = dto.defaultDurationMinutes;
        }
        if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder;

        await this.uniqueness.assertAvailable(transaction, uniqueInput, id);
        const updated = await transaction.service.update({
          where: { id },
          data: updates,
          select: adminServiceSelect,
        });
        await this.auditService.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_UPDATED',
            resourceType: 'Service',
            resourceId: id,
            result: 'SUCCESS',
            metadata: {
              before: toServiceAuditSnapshot(existing),
              after: toServiceAuditSnapshot(updated),
            },
          },
          request,
          transaction,
        );
        return updated;
      });

      await this.cache.invalidateActive();
      return {
        success: true,
        message: 'Cập nhật dịch vụ thành công.',
        data: service,
      };
    } catch (error: unknown) {
      rethrowServiceWriteError(error);
    }
  }
}
