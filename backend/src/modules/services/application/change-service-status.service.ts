import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceCategoryStatus, ServiceStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { UpdateServiceStatusDto } from '../dto/update-service-status.dto';
import { assertServiceStatusTransition } from '../domain/service-status.policy';
import { adminServiceSelect } from './service.select';
import { ServiceCacheService } from './service-cache.service';

@Injectable()
export class ChangeServiceStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: ServiceCacheService,
  ) {}

  async execute(
    id: string,
    dto: UpdateServiceStatusDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const service = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.service.findUnique({
        where: { id },
        include: { category: { select: { status: true } } },
      });
      if (!existing) throw new NotFoundException('Không tìm thấy dịch vụ.');

      assertServiceStatusTransition(existing.status, dto.status);
      if (
        dto.status === ServiceStatus.ACTIVE &&
        existing.category.status !== ServiceCategoryStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Chỉ có thể kích hoạt dịch vụ khi danh mục đang hoạt động.',
        );
      }

      const updated = await transaction.service.update({
        where: { id },
        data: { status: dto.status, updatedById: actorId },
        select: adminServiceSelect,
      });
      await this.auditService.record(
        {
          actorInternalAccountId: actorId,
          action: 'SERVICE_STATUS_CHANGED',
          resourceType: 'Service',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { from: existing.status, to: dto.status },
        },
        request,
        transaction,
      );
      return updated;
    });

    await this.cache.invalidateActive();
    return {
      success: true,
      message: 'Cập nhật trạng thái dịch vụ thành công.',
      data: service,
    };
  }
}
