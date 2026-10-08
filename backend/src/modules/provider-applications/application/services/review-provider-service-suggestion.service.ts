import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderApplicationSection,
  ProviderServiceSuggestionStatus,
  ReviewStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  ServiceTargetAudience,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { ServiceCacheService } from '../../../services/application/service-cache.service';
import {
  rethrowServiceWriteError,
  ServiceUniquenessService,
} from '../../../services/application/service-uniqueness.service';
import { normalizeServiceName } from '../../../services/domain/service-normalizer';
import { assertValidPriceRange } from '../../../services/domain/service-status.policy';
import type {
  ApproveProviderServiceSuggestionDto,
  RejectProviderServiceSuggestionDto,
} from '../../dto/provider-service-suggestion.dto';
import {
  assertPendingApplication,
  lockProviderApplication,
} from '../persistence/provider-application-lock';
import { assertProviderServiceEligible } from '../../domain/provider-service-eligibility.policy';

@Injectable()
export class ReviewProviderServiceSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uniqueness: ServiceUniquenessService,
    private readonly cache: ServiceCacheService,
  ) {}

  async approve(
    applicationId: string,
    suggestionId: string,
    dto: ApproveProviderServiceSuggestionDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    assertValidPriceRange(dto.minPriceAmount, dto.maxPriceAmount);
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const normalizedName = normalizeServiceName(name);
    const slug = dto.slug.trim().toLowerCase();
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const { suggestion, application } = await this.findPending(
          transaction,
          applicationId,
          suggestionId,
        );
        if (
          suggestion.proposedPriceAmount < dto.minPriceAmount ||
          suggestion.proposedPriceAmount > dto.maxPriceAmount
        )
          throw new BadRequestException(
            'Giá của đối tác phải nằm trong giá sàn/trần được duyệt.',
          );
        const category = await transaction.serviceCategory.findUnique({
          where: { id: dto.categoryId },
          select: { status: true },
        });
        if (!category || category.status !== ServiceCategoryStatus.ACTIVE)
          throw new BadRequestException('Danh mục phải đang hoạt động.');
        await this.uniqueness.assertAvailable(transaction, {
          categoryId: dto.categoryId,
          code,
          normalizedName,
          slug,
        });
        const service = await transaction.service.create({
          data: {
            categoryId: dto.categoryId,
            code,
            name,
            normalizedName,
            slug,
            description:
              dto.description === undefined
                ? suggestion.description
                : (dto.description?.trim() ?? null),
            iconUrl: dto.iconUrl?.trim() ?? null,
            minPriceAmount: dto.minPriceAmount,
            maxPriceAmount: dto.maxPriceAmount,
            currencyCode: 'VND',
            defaultDurationMinutes:
              dto.defaultDurationMinutes === undefined
                ? suggestion.durationMinutes
                : dto.defaultDurationMinutes,
            targetAudience: dto.targetAudience ?? ServiceTargetAudience.ALL,
            requiresCertificate: dto.requiresCertificate ?? false,
            minPortfolioImages: dto.minPortfolioImages ?? 0,
            minExperienceYears: dto.minExperienceYears ?? 0,
            sortOrder: dto.sortOrder ?? 0,
            status: ServiceStatus.ACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        const applicationService =
          await transaction.providerApplicationService.create({
            data: {
              applicationId,
              serviceId: service.id,
              proposedPriceAmount: suggestion.proposedPriceAmount,
              durationMinutes: suggestion.durationMinutes,
              description: suggestion.description,
              status: ReviewStatus.VERIFIED,
              reviewNote: null,
              reviewedById: actorId,
              reviewedAt: new Date(),
            },
          });
        assertProviderServiceEligible(
          {
            id: applicationService.id,
            proposedPriceAmount: applicationService.proposedPriceAmount,
            service: { ...service, category },
          },
          application.experienceYears,
          application.documents,
          false,
        );
        await transaction.providerServiceSuggestion.update({
          where: { id: suggestionId },
          data: {
            status: ProviderServiceSuggestionStatus.APPROVED,
            approvedServiceId: service.id,
            reviewedById: actorId,
            reviewedAt: new Date(),
          },
        });
        await transaction.providerApplicationCheck.updateMany({
          where: {
            applicationId,
            section: ProviderApplicationSection.SERVICES,
          },
          data: {
            status: ReviewStatus.PENDING,
            reviewNote: null,
            reviewedById: null,
            reviewedAt: null,
          },
        });
        await this.audit.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_CREATED_FROM_PROVIDER_SUGGESTION',
            resourceType: 'Service',
            resourceId: service.id,
            result: 'SUCCESS',
            metadata: {
              applicationId,
              suggestionId,
              applicationServiceId: applicationService.id,
            },
          },
          request,
          transaction,
        );
        return { service, applicationService };
      });
      await this.cache.invalidateActive();
      return {
        success: true,
        message: 'Đã tạo dịch vụ và xác minh dịch vụ đăng ký.',
        data: result,
      };
    } catch (error: unknown) {
      rethrowServiceWriteError(error);
    }
  }

  async reject(
    applicationId: string,
    suggestionId: string,
    dto: RejectProviderServiceSuggestionDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    const suggestion = await this.prisma.$transaction(async (transaction) => {
      await this.findPending(transaction, applicationId, suggestionId);
      const rejected = await transaction.providerServiceSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: ProviderServiceSuggestionStatus.REJECTED,
          reviewNote: dto.reason.trim(),
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      await transaction.providerApplicationCheck.updateMany({
        where: { applicationId, section: ProviderApplicationSection.SERVICES },
        data: {
          status: ReviewStatus.PENDING,
          reviewNote: null,
          reviewedById: null,
          reviewedAt: null,
        },
      });
      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action: 'PROVIDER_SERVICE_SUGGESTION_REJECTED',
          resourceType: 'ProviderServiceSuggestion',
          resourceId: suggestionId,
          result: 'SUCCESS',
          metadata: { applicationId, reason: dto.reason.trim() },
        },
        request,
        transaction,
      );
      return rejected;
    });
    return { success: true, message: 'Đã từ chối đề xuất.', data: suggestion };
  }

  private async findPending(
    transaction: Prisma.TransactionClient,
    applicationId: string,
    suggestionId: string,
  ) {
    await lockProviderApplication(transaction, applicationId);
    const application = await transaction.providerApplication.findUnique({
      where: { id: applicationId },
      select: {
        status: true,
        experienceYears: true,
        documents: true,
      },
    });
    if (!application)
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký.');
    assertPendingApplication(application.status);
    const suggestion = await transaction.providerServiceSuggestion.findFirst({
      where: { id: suggestionId, applicationId },
    });
    if (!suggestion)
      throw new NotFoundException('Không tìm thấy đề xuất dịch vụ.');
    if (suggestion.status !== ProviderServiceSuggestionStatus.PENDING)
      throw new ConflictException('Đề xuất đã được xử lý.');
    return { suggestion, application };
  }
}
