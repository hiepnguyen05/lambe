import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  InternalRole,
  ProviderDocumentType,
  ProviderServiceChangeStatus,
  ProviderServiceChangeType,
  ProviderServiceStatus,
  ReviewStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  ServiceTargetAudience,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { normalizeName } from '../../../../common/utils/text-normalizer';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { ServiceCacheService } from '../../../services/application/service-cache.service';
import { ServiceUniquenessService } from '../../../services/application/service-uniqueness.service';
import { assertProviderServiceEligible } from '../../../provider-applications/domain/provider-service-eligibility.policy';
import type {
  ApproveProviderServiceChangeDto,
  ProviderServiceChangeDecisionDto,
} from '../../dto/provider-service-change.dto';
import {
  lockProviderForServiceChange,
  serviceChangeInclude,
} from './provider-service-changes.service';
import { ProviderServiceChangeNotificationService } from './provider-service-change-notification.service';

@Injectable()
export class ProviderServiceChangeReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uniqueness: ServiceUniquenessService,
    private readonly cache: ServiceCacheService,
    private readonly notifications: ProviderServiceChangeNotificationService,
  ) {}

  async approve(
    id: string,
    dto: ApproveProviderServiceChangeDto,
    actorId: string,
    roles: InternalRole[],
    request: RequestMetadata,
  ) {
    let createdService = false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const found = await tx.providerServiceChangeRequest.findUnique({
          where: { id },
          select: { providerId: true },
        });
        if (!found)
          throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
        const provider = await lockProviderForServiceChange(
          tx,
          undefined,
          found.providerId,
        );
        const current = await tx.providerServiceChangeRequest.findUniqueOrThrow(
          {
            where: { id },
            include: { documents: true },
          },
        );
        if (current.status !== ProviderServiceChangeStatus.PENDING_REVIEW)
          throw new ConflictException('Yêu cầu không còn chờ xét duyệt.');
        if (
          current.type === ProviderServiceChangeType.PROPOSE_NEW_SERVICE &&
          !roles.includes(InternalRole.ADMIN)
        )
          throw new ForbiddenException(
            'Chỉ Admin được xử lý dịch vụ mới của hệ thống.',
          );
        if (provider.status === 'SUSPENDED')
          throw new ConflictException('Đối tác đang bị đình chỉ.');
        if (
          current.type !== ProviderServiceChangeType.PROPOSE_NEW_SERVICE &&
          (dto.createService || dto.mapToServiceId)
        )
          throw new BadRequestException(
            'Chỉ đề xuất dịch vụ mới mới cần thông tin danh mục.',
          );

        let serviceId = current.serviceId;
        if (current.type === ProviderServiceChangeType.PROPOSE_NEW_SERVICE) {
          if (Boolean(dto.createService) === Boolean(dto.mapToServiceId))
            throw new BadRequestException(
              'Chọn tạo dịch vụ mới hoặc ghép với dịch vụ đã có.',
            );
          if (dto.mapToServiceId) serviceId = dto.mapToServiceId;
          else {
            const created = await this.createCatalogService(
              tx,
              current,
              dto.createService!,
              actorId,
            );
            serviceId = created.id;
            createdService = true;
          }
        }
        await tx.$queryRaw(Prisma.sql`
          SELECT service."id" FROM "services" service
          JOIN "service_categories" category ON category."id" = service."categoryId"
          WHERE service."id" = ${serviceId!}
          FOR SHARE OF service, category
        `);
        const service = await tx.service.findUnique({
          where: { id: serviceId! },
          include: { category: true },
        });
        if (
          !service ||
          service.status !== ServiceStatus.ACTIVE ||
          service.category.status !== ServiceCategoryStatus.ACTIVE
        )
          throw new BadRequestException(
            'Dịch vụ hoặc danh mục không hoạt động.',
          );
        const documents = await this.evidence(
          tx,
          provider.id,
          provider.sourceApplicationId,
          service.id,
          current,
        );
        assertProviderServiceEligible(
          {
            id: current.id,
            proposedPriceAmount: current.proposedPriceAmount,
            service,
          },
          provider.experienceYears,
          documents,
          true,
        );

        if (current.type === ProviderServiceChangeType.UPDATE_OFFERING) {
          const offering = await tx.providerService.findFirst({
            where: {
              id: current.providerServiceId!,
              providerId: provider.id,
              serviceId: service.id,
            },
          });
          if (!offering)
            throw new NotFoundException('Dịch vụ đối tác không còn tồn tại.');
          await tx.providerService.update({
            where: { id: offering.id },
            data: {
              priceAmount: current.proposedPriceAmount,
              durationMinutes: current.proposedDurationMinutes,
              description: current.proposedDescription,
            },
          });
        } else {
          if (
            await tx.providerService.findUnique({
              where: {
                providerId_serviceId: {
                  providerId: provider.id,
                  serviceId: service.id,
                },
              },
            })
          )
            throw new ConflictException('Đối tác đã cung cấp dịch vụ này.');
          if (
            (await tx.providerService.count({
              where: { providerId: provider.id },
            })) >= 20
          )
            throw new BadRequestException('Đối tác đã có tối đa 20 dịch vụ.');
          await tx.providerService.create({
            data: {
              providerId: provider.id,
              serviceId: service.id,
              sourceApplicationId: provider.sourceApplicationId,
              priceAmount: current.proposedPriceAmount,
              durationMinutes: current.proposedDurationMinutes,
              description: current.proposedDescription,
              status: ProviderServiceStatus.INACTIVE,
            },
          });
        }
        await tx.providerServiceChangeDocument.updateMany({
          where: { requestId: id },
          data: { status: ReviewStatus.VERIFIED },
        });
        const updated = await tx.providerServiceChangeRequest.update({
          where: { id },
          data: {
            status: ProviderServiceChangeStatus.APPROVED,
            serviceId: service.id,
            reviewedById: actorId,
            reviewedAt: new Date(),
            reviewNote: null,
          },
          include: serviceChangeInclude,
        });
        const source = await tx.providerApplication.findUnique({
          where: { id: provider.sourceApplicationId },
          select: { email: true },
        });
        await this.notifications.enqueue(
          {
            requestId: id,
            userId: provider.userId,
            email: source?.email ?? null,
          },
          ProviderServiceChangeStatus.APPROVED,
          tx,
        );
        await this.audit.record(
          {
            actorInternalAccountId: actorId,
            action: 'PROVIDER_SERVICE_CHANGE_APPROVED',
            resourceType: 'ProviderServiceChangeRequest',
            resourceId: id,
            result: 'SUCCESS',
            metadata: {
              providerId: provider.id,
              serviceId: service.id,
              type: current.type,
            },
          },
          request,
          tx,
        );
        return updated;
      });
      if (createdService) await this.cache.invalidateActive();
      return { success: true, data: result };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Dịch vụ đã tồn tại hoặc đang được đối tác cung cấp.',
        );
      throw error;
    }
  }

  async requestChanges(
    id: string,
    dto: ProviderServiceChangeDecisionDto,
    actorId: string,
    roles: InternalRole[],
    request: RequestMetadata,
  ) {
    return this.decide(
      id,
      ProviderServiceChangeStatus.NEEDS_CHANGES,
      dto.reason,
      actorId,
      roles,
      request,
    );
  }

  async reject(
    id: string,
    dto: ProviderServiceChangeDecisionDto,
    actorId: string,
    roles: InternalRole[],
    request: RequestMetadata,
  ) {
    return this.decide(
      id,
      ProviderServiceChangeStatus.REJECTED,
      dto.reason,
      actorId,
      roles,
      request,
    );
  }

  private async decide(
    id: string,
    status: ProviderServiceChangeStatus,
    reason: string,
    actorId: string,
    roles: InternalRole[],
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const found = await tx.providerServiceChangeRequest.findUnique({
        where: { id },
        select: { providerId: true },
      });
      if (!found)
        throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
      const provider = await lockProviderForServiceChange(
        tx,
        undefined,
        found.providerId,
      );
      const current = await tx.providerServiceChangeRequest.findUniqueOrThrow({
        where: { id },
      });
      if (current.status !== ProviderServiceChangeStatus.PENDING_REVIEW)
        throw new ConflictException('Yêu cầu không còn chờ xét duyệt.');
      if (
        current.type === ProviderServiceChangeType.PROPOSE_NEW_SERVICE &&
        !roles.includes(InternalRole.ADMIN)
      )
        throw new ForbiddenException(
          'Chỉ Admin được xử lý dịch vụ mới của hệ thống.',
        );
      const updated = await tx.providerServiceChangeRequest.update({
        where: { id },
        data: {
          status,
          reviewNote: reason.trim(),
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
        include: serviceChangeInclude,
      });
      const source = await tx.providerApplication.findUnique({
        where: { id: provider.sourceApplicationId },
        select: { email: true },
      });
      await this.notifications.enqueue(
        {
          requestId: id,
          userId: provider.userId,
          email: source?.email ?? null,
        },
        status,
        tx,
      );
      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action:
            status === ProviderServiceChangeStatus.REJECTED
              ? 'PROVIDER_SERVICE_CHANGE_REJECTED'
              : 'PROVIDER_SERVICE_CHANGE_NEEDS_CHANGES',
          resourceType: 'ProviderServiceChangeRequest',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { reason: reason.trim() },
        },
        request,
        tx,
      );
      return updated;
    });
    return { success: true, data: result };
  }

  private async createCatalogService(
    tx: Prisma.TransactionClient,
    request: {
      proposedDescription: string | null;
      proposedDurationMinutes: number | null;
      proposedPriceAmount: number;
    },
    dto: NonNullable<ApproveProviderServiceChangeDto['createService']>,
    actorId: string,
  ) {
    if (
      dto.minPriceAmount > dto.maxPriceAmount ||
      request.proposedPriceAmount < dto.minPriceAmount ||
      request.proposedPriceAmount > dto.maxPriceAmount
    )
      throw new BadRequestException(
        'Giá đề xuất phải nằm trong giá sàn/trần được duyệt.',
      );
    const category = await tx.serviceCategory.findUnique({
      where: { id: dto.categoryId },
      select: { status: true },
    });
    if (!category || category.status !== ServiceCategoryStatus.ACTIVE)
      throw new BadRequestException('Danh mục phải đang hoạt động.');
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const normalizedName = normalizeName(name);
    const slug = dto.slug.trim().toLowerCase();
    await this.uniqueness.assertAvailable(tx, {
      categoryId: dto.categoryId,
      code,
      normalizedName,
      slug,
    });
    return tx.service.create({
      data: {
        categoryId: dto.categoryId,
        code,
        name,
        normalizedName,
        slug,
        description: dto.description?.trim() ?? request.proposedDescription,
        iconUrl: dto.iconUrl?.trim() ?? null,
        minPriceAmount: dto.minPriceAmount,
        maxPriceAmount: dto.maxPriceAmount,
        currencyCode: 'VND',
        defaultDurationMinutes:
          dto.defaultDurationMinutes ?? request.proposedDurationMinutes,
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
  }

  private async evidence(
    tx: Prisma.TransactionClient,
    providerId: string,
    sourceApplicationId: string,
    serviceId: string,
    request: {
      id: string;
      documents: Array<{
        type: ProviderDocumentType;
        status: ReviewStatus;
        deliveryType: string;
        fileFormat: string;
      }>;
    },
  ) {
    const approved = await tx.providerApplicationDocument.findMany({
      where: {
        applicationId: sourceApplicationId,
        status: ReviewStatus.VERIFIED,
        OR: [
          { applicationServiceId: null },
          { applicationService: { serviceId } },
        ],
      },
      select: { type: true, deliveryType: true, fileFormat: true },
    });
    const prior = await tx.providerServiceChangeDocument.findMany({
      where: {
        request: {
          providerId,
          serviceId,
          status: ProviderServiceChangeStatus.APPROVED,
        },
        status: ReviewStatus.VERIFIED,
      },
      select: { type: true, deliveryType: true, fileFormat: true },
    });
    return [
      ...approved.map((item) => ({
        ...item,
        applicationServiceId: request.id,
        status: ReviewStatus.VERIFIED,
      })),
      ...prior.map((item) => ({
        ...item,
        applicationServiceId: request.id,
        status: ReviewStatus.VERIFIED,
      })),
      ...request.documents.map((item) => ({
        ...item,
        applicationServiceId: request.id,
        status: ReviewStatus.VERIFIED,
      })),
    ];
  }
}
