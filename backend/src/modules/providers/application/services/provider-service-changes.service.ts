import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderProfileStatus,
  ProviderServiceChangeStatus,
  ProviderServiceChangeType,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { normalizeName } from '../../../../common/utils/text-normalizer';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  CreateProviderServiceChangeDto,
  ProviderServiceChangeQueryDto,
  UpdateProviderServiceChangeDto,
} from '../../dto/provider-service-change.dto';
import { ProviderServiceChangeNotificationService } from './provider-service-change-notification.service';

export const serviceChangeInclude = {
  service: {
    select: {
      id: true,
      name: true,
      status: true,
      minPriceAmount: true,
      maxPriceAmount: true,
      requiresCertificate: true,
      minPortfolioImages: true,
      minExperienceYears: true,
      category: { select: { id: true, name: true, status: true } },
    },
  },
  providerService: {
    select: {
      id: true,
      status: true,
      priceAmount: true,
      durationMinutes: true,
      description: true,
    },
  },
  category: { select: { id: true, name: true, status: true } },
  documents: {
    select: { id: true, type: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProviderServiceChangeRequestInclude;

export async function lockProviderForServiceChange(
  tx: Prisma.TransactionClient,
  userId?: string,
  providerId?: string,
) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "provider_profiles"
    WHERE (${userId ?? null}::text IS NULL OR "userId" = ${userId ?? null})
      AND (${providerId ?? null}::text IS NULL OR "id" = ${providerId ?? null})
    FOR UPDATE
  `);
  if (!rows.length)
    throw new NotFoundException('Không tìm thấy hồ sơ đối tác.');
  const provider = await tx.providerProfile.findUniqueOrThrow({
    where: { id: rows[0].id },
    select: {
      id: true,
      userId: true,
      status: true,
      sourceApplicationId: true,
      experienceYears: true,
    },
  });
  return provider;
}

export function assertChangeEditable(status: ProviderServiceChangeStatus) {
  if (
    status !== ProviderServiceChangeStatus.DRAFT &&
    status !== ProviderServiceChangeStatus.NEEDS_CHANGES
  )
    throw new ConflictException('Yêu cầu đã gửi hoặc đã xử lý.');
}

@Injectable()
export class ProviderServiceChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: ProviderServiceChangeNotificationService,
  ) {}

  async listMine(userId: string, query: ProviderServiceChangeQueryDto) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('Không tìm thấy hồ sơ đối tác.');
    return this.list({ providerId: provider.id, status: query.status }, query);
  }

  async listInternal(query: ProviderServiceChangeQueryDto) {
    return this.list({ status: query.status }, query);
  }

  private async list(
    where: Prisma.ProviderServiceChangeRequestWhereInput,
    query: ProviderServiceChangeQueryDto,
  ) {
    const [total, rows] = await Promise.all([
      this.prisma.providerServiceChangeRequest.count({ where }),
      this.prisma.providerServiceChangeRequest.findMany({
        where,
        include: serviceChangeInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      success: true,
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findMine(userId: string, id: string) {
    const row = await this.prisma.providerServiceChangeRequest.findFirst({
      where: { id, provider: { userId } },
      include: serviceChangeInclude,
    });
    if (!row) throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
    return { success: true, data: row };
  }

  async findInternal(id: string) {
    const row = await this.prisma.providerServiceChangeRequest.findUnique({
      where: { id },
      include: {
        ...serviceChangeInclude,
        provider: {
          select: {
            id: true,
            displayName: true,
            status: true,
            experienceYears: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
    return { success: true, data: row };
  }

  async create(
    userId: string,
    dto: CreateProviderServiceChangeDto,
    request: RequestMetadata,
  ) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const provider = await lockProviderForServiceChange(tx, userId);
        if (provider.status === ProviderProfileStatus.SUSPENDED)
          throw new ForbiddenException('Đối tác đang bị đình chỉ.');
        const pendingCount = await tx.providerServiceChangeRequest.count({
          where: {
            providerId: provider.id,
            type: {
              in: [
                ProviderServiceChangeType.ADD_EXISTING_SERVICE,
                ProviderServiceChangeType.PROPOSE_NEW_SERVICE,
              ],
            },
            status: {
              in: [
                ProviderServiceChangeStatus.DRAFT,
                ProviderServiceChangeStatus.PENDING_REVIEW,
                ProviderServiceChangeStatus.NEEDS_CHANGES,
              ],
            },
          },
        });
        const offeringCount = await tx.providerService.count({
          where: { providerId: provider.id },
        });
        if (
          dto.type !== ProviderServiceChangeType.UPDATE_OFFERING &&
          offeringCount + pendingCount >= 20
        )
          throw new BadRequestException(
            'Mỗi đối tác được cung cấp tối đa 20 dịch vụ.',
          );
        const target = await this.resolveTarget(tx, provider.id, dto);
        const created = await tx.providerServiceChangeRequest.create({
          data: {
            providerId: provider.id,
            providerServiceId: target.providerServiceId,
            serviceId: target.serviceId,
            categoryId: target.categoryId,
            proposedName: target.name,
            normalizedName: target.normalizedName,
            type: dto.type,
            proposedPriceAmount: dto.proposedPriceAmount,
            proposedDurationMinutes:
              dto.proposedDurationMinutes === undefined
                ? target.durationMinutes
                : dto.proposedDurationMinutes,
            proposedDescription:
              dto.proposedDescription === undefined
                ? target.description
                : dto.proposedDescription,
          },
          include: serviceChangeInclude,
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'PROVIDER_SERVICE_CHANGE_DRAFTED',
            resourceType: 'ProviderServiceChangeRequest',
            resourceId: created.id,
            result: 'SUCCESS',
          },
          request,
          tx,
        );
        return created;
      });
      return { success: true, data: row };
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateProviderServiceChangeDto,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('Không có dữ liệu cần cập nhật.');
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const provider = await lockProviderForServiceChange(tx, userId);
        if (provider.status === ProviderProfileStatus.SUSPENDED)
          throw new ForbiddenException('Đối tác đang bị đình chỉ.');
        const current = await tx.providerServiceChangeRequest.findFirst({
          where: { id, providerId: provider.id },
        });
        if (!current)
          throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
        assertChangeEditable(current.status);
        if (
          current.type !== ProviderServiceChangeType.PROPOSE_NEW_SERVICE &&
          (dto.name !== undefined || dto.categoryId !== undefined)
        )
          throw new BadRequestException(
            'Không thể đổi tên hoặc danh mục của dịch vụ đã có.',
          );
        if (current.type === ProviderServiceChangeType.PROPOSE_NEW_SERVICE) {
          await this.assertCategoryAndUniqueName(
            tx,
            dto.categoryId ?? current.categoryId!,
            dto.name ?? current.proposedName!,
          );
        }
        const price = dto.proposedPriceAmount ?? current.proposedPriceAmount;
        if (current.serviceId)
          await this.assertActiveServiceAndPrice(tx, current.serviceId, price);
        return tx.providerServiceChangeRequest.update({
          where: { id },
          data: {
            proposedPriceAmount: dto.proposedPriceAmount,
            proposedDurationMinutes: dto.proposedDurationMinutes,
            proposedDescription: dto.proposedDescription,
            proposedName: dto.name,
            normalizedName: dto.name ? normalizeName(dto.name) : undefined,
            categoryId: dto.categoryId,
            status: ProviderServiceChangeStatus.DRAFT,
            reviewNote: null,
            reviewedById: null,
            reviewedAt: null,
          },
          include: serviceChangeInclude,
        });
      });
      return { success: true, data: row };
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async submit(userId: string, id: string, request: RequestMetadata) {
    const row = await this.prisma.$transaction(async (tx) => {
      const provider = await lockProviderForServiceChange(tx, userId);
      if (provider.status === ProviderProfileStatus.SUSPENDED)
        throw new ForbiddenException('Đối tác đang bị đình chỉ.');
      const current = await tx.providerServiceChangeRequest.findFirst({
        where: { id, providerId: provider.id },
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
      assertChangeEditable(current.status);
      if (current.serviceId)
        await this.assertActiveServiceAndPrice(
          tx,
          current.serviceId,
          current.proposedPriceAmount,
        );
      else
        await this.assertCategoryAndUniqueName(
          tx,
          current.categoryId!,
          current.proposedName!,
        );
      const updated = await tx.providerServiceChangeRequest.update({
        where: { id },
        data: {
          status: ProviderServiceChangeStatus.PENDING_REVIEW,
          submittedAt: new Date(),
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
        ProviderServiceChangeStatus.PENDING_REVIEW,
        tx,
      );
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_SERVICE_CHANGE_SUBMITTED',
          resourceType: 'ProviderServiceChangeRequest',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        tx,
      );
      return updated;
    });
    return { success: true, data: row };
  }

  async withdraw(userId: string, id: string, request: RequestMetadata) {
    const row = await this.prisma.$transaction(async (tx) => {
      const provider = await lockProviderForServiceChange(tx, userId);
      const current = await tx.providerServiceChangeRequest.findFirst({
        where: { id, providerId: provider.id },
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
      if (
        !new Set<ProviderServiceChangeStatus>([
          ProviderServiceChangeStatus.DRAFT,
          ProviderServiceChangeStatus.NEEDS_CHANGES,
          ProviderServiceChangeStatus.PENDING_REVIEW,
        ]).has(current.status)
      )
        throw new ConflictException('Yêu cầu đã được xử lý.');
      const updated = await tx.providerServiceChangeRequest.update({
        where: { id },
        data: { status: ProviderServiceChangeStatus.WITHDRAWN },
        include: serviceChangeInclude,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_SERVICE_CHANGE_WITHDRAWN',
          resourceType: 'ProviderServiceChangeRequest',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        tx,
      );
      return updated;
    });
    return { success: true, data: row };
  }

  private async resolveTarget(
    tx: Prisma.TransactionClient,
    providerId: string,
    dto: CreateProviderServiceChangeDto,
  ) {
    if (dto.type === ProviderServiceChangeType.UPDATE_OFFERING) {
      if (!dto.providerServiceId || dto.serviceId || dto.categoryId || dto.name)
        throw new BadRequestException(
          'Chỉ truyền providerServiceId khi chỉnh sửa dịch vụ của mình.',
        );
      const offering = await tx.providerService.findFirst({
        where: { id: dto.providerServiceId, providerId },
      });
      if (!offering)
        throw new NotFoundException('Không tìm thấy dịch vụ của đối tác.');
      await this.assertActiveServiceAndPrice(
        tx,
        offering.serviceId,
        dto.proposedPriceAmount,
      );
      return {
        providerServiceId: offering.id,
        serviceId: offering.serviceId,
        categoryId: null,
        name: null,
        normalizedName: null,
        durationMinutes: offering.durationMinutes,
        description: offering.description,
      };
    }
    if (dto.type === ProviderServiceChangeType.ADD_EXISTING_SERVICE) {
      if (!dto.serviceId || dto.providerServiceId || dto.categoryId || dto.name)
        throw new BadRequestException(
          'Chỉ truyền serviceId khi thêm dịch vụ trong danh mục.',
        );
      if (
        await tx.providerService.findUnique({
          where: {
            providerId_serviceId: { providerId, serviceId: dto.serviceId },
          },
        })
      )
        throw new ConflictException('Đối tác đã đăng ký dịch vụ này.');
      await this.assertActiveServiceAndPrice(
        tx,
        dto.serviceId,
        dto.proposedPriceAmount,
      );
      return {
        providerServiceId: null,
        serviceId: dto.serviceId,
        categoryId: null,
        name: null,
        normalizedName: null,
        durationMinutes: null,
        description: null,
      };
    }
    if (dto.type === ProviderServiceChangeType.PROPOSE_NEW_SERVICE) {
      if (
        !dto.categoryId ||
        !dto.name ||
        dto.serviceId ||
        dto.providerServiceId
      )
        throw new BadRequestException(
          'Cần danh mục và tên dịch vụ muốn đề xuất.',
        );
      await this.assertCategoryAndUniqueName(tx, dto.categoryId, dto.name);
      return {
        providerServiceId: null,
        serviceId: null,
        categoryId: dto.categoryId,
        name: dto.name,
        normalizedName: normalizeName(dto.name),
        durationMinutes: null,
        description: null,
      };
    }
    throw new BadRequestException('Loại đề xuất không hợp lệ.');
  }

  private async assertActiveServiceAndPrice(
    tx: Prisma.TransactionClient,
    id: string,
    price: number,
  ) {
    const service = await tx.service.findFirst({
      where: {
        id,
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
      select: { minPriceAmount: true, maxPriceAmount: true },
    });
    if (!service)
      throw new BadRequestException('Dịch vụ hoặc danh mục không hoạt động.');
    if (price < service.minPriceAmount || price > service.maxPriceAmount)
      throw new BadRequestException(
        `Giá phải trong khoảng ${service.minPriceAmount}–${service.maxPriceAmount} VND.`,
      );
  }

  private async assertCategoryAndUniqueName(
    tx: Prisma.TransactionClient,
    categoryId: string,
    name: string,
  ) {
    const category = await tx.serviceCategory.findFirst({
      where: { id: categoryId, status: ServiceCategoryStatus.ACTIVE },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Danh mục chưa hoạt động.');
    const existing = await tx.service.findFirst({
      where: { categoryId, normalizedName: normalizeName(name) },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException(
        'Dịch vụ đã có trong hệ thống; hãy chọn từ danh mục.',
      );
  }

  private rethrowDuplicate(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException('Đã có yêu cầu chưa xử lý cho dịch vụ này.');
    throw error;
  }
}
