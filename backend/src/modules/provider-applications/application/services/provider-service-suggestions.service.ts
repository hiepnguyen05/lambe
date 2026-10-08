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
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { normalizeServiceName } from '../../../services/domain/service-normalizer';
import type {
  CreateProviderServiceSuggestionDto,
  UpdateProviderServiceSuggestionDto,
} from '../../dto/provider-service-suggestion.dto';
import {
  assertApplicationEditable,
  assertProviderSectionsEditable,
} from '../../domain/provider-application.policy';
import { lockProviderApplication } from '../persistence/provider-application-lock';

@Injectable()
export class ProviderServiceSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async add(
    applicationId: string,
    userId: string,
    dto: CreateProviderServiceSuggestionDto,
  ) {
    try {
      const suggestion = await this.prisma.$transaction(async (transaction) => {
        await this.assertEditable(transaction, applicationId, userId);
        await this.assertCategoryAndName(transaction, dto.categoryId, dto.name);
        await this.assertLimit(transaction, applicationId);
        const created = await transaction.providerServiceSuggestion.create({
          data: {
            applicationId,
            categoryId: dto.categoryId,
            name: dto.name.trim(),
            normalizedName: normalizeServiceName(dto.name),
            description: dto.description?.trim() ?? null,
            proposedPriceAmount: dto.proposedPriceAmount,
            durationMinutes: dto.durationMinutes ?? null,
          },
        });
        await this.resetServiceCheck(transaction, applicationId);
        return created;
      });
      return { success: true, data: suggestion };
    } catch (error: unknown) {
      this.rethrowUnique(error);
    }
  }

  async update(
    applicationId: string,
    suggestionId: string,
    userId: string,
    dto: UpdateProviderServiceSuggestionDto,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('Không có dữ liệu đề xuất cần cập nhật.');
    try {
      const suggestion = await this.prisma.$transaction(async (transaction) => {
        await this.assertEditable(transaction, applicationId, userId);
        const current = await transaction.providerServiceSuggestion.findFirst({
          where: { id: suggestionId, applicationId },
        });
        if (!current)
          throw new NotFoundException('Không tìm thấy đề xuất dịch vụ.');
        if (current.status === ProviderServiceSuggestionStatus.APPROVED)
          throw new ConflictException('Dịch vụ đã được duyệt vào hệ thống.');
        const categoryId = dto.categoryId ?? current.categoryId;
        const name = dto.name ?? current.name;
        await this.assertCategoryAndName(transaction, categoryId, name);
        const updated = await transaction.providerServiceSuggestion.update({
          where: { id: suggestionId },
          data: {
            categoryId,
            name: name.trim(),
            normalizedName: normalizeServiceName(name),
            ...(dto.description !== undefined && {
              description: dto.description?.trim() ?? null,
            }),
            ...(dto.proposedPriceAmount !== undefined && {
              proposedPriceAmount: dto.proposedPriceAmount,
            }),
            ...(dto.durationMinutes !== undefined && {
              durationMinutes: dto.durationMinutes,
            }),
            status: ProviderServiceSuggestionStatus.PENDING,
            reviewNote: null,
            reviewedById: null,
            reviewedAt: null,
          },
        });
        await this.resetServiceCheck(transaction, applicationId);
        return updated;
      });
      return { success: true, data: suggestion };
    } catch (error: unknown) {
      this.rethrowUnique(error);
    }
  }

  async remove(applicationId: string, suggestionId: string, userId: string) {
    await this.prisma.$transaction(async (transaction) => {
      await this.assertEditable(transaction, applicationId, userId);
      const suggestion = await transaction.providerServiceSuggestion.findFirst({
        where: { id: suggestionId, applicationId },
        select: { status: true },
      });
      if (!suggestion)
        throw new NotFoundException('Không tìm thấy đề xuất dịch vụ.');
      if (suggestion.status === ProviderServiceSuggestionStatus.APPROVED)
        throw new ConflictException('Dịch vụ đã được duyệt vào hệ thống.');
      await transaction.providerServiceSuggestion.delete({
        where: { id: suggestionId },
      });
      await this.resetServiceCheck(transaction, applicationId);
    });
    return { success: true, message: 'Đã xóa đề xuất dịch vụ.' };
  }

  private async assertEditable(
    transaction: Prisma.TransactionClient,
    applicationId: string,
    userId: string,
  ) {
    await lockProviderApplication(transaction, applicationId, userId);
    const application = await transaction.providerApplication.findFirst({
      where: { id: applicationId, userId },
      include: { checks: true },
    });
    if (!application)
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký.');
    assertApplicationEditable(application.status);
    assertProviderSectionsEditable(application, [
      ProviderApplicationSection.SERVICES,
    ]);
  }

  private async assertCategoryAndName(
    transaction: Prisma.TransactionClient,
    categoryId: string,
    name: string,
  ) {
    const category = await transaction.serviceCategory.findFirst({
      where: { id: categoryId, status: ServiceCategoryStatus.ACTIVE },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Danh mục không hoạt động.');
    const existing = await transaction.service.findFirst({
      where: { categoryId, normalizedName: normalizeServiceName(name) },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException(
        'Dịch vụ đã có trong hệ thống. Hãy chọn dịch vụ hiện có.',
      );
  }

  private async assertLimit(
    transaction: Prisma.TransactionClient,
    applicationId: string,
  ) {
    const [services, suggestions] = await Promise.all([
      transaction.providerApplicationService.count({
        where: { applicationId },
      }),
      transaction.providerServiceSuggestion.count({
        where: {
          applicationId,
          status: { not: ProviderServiceSuggestionStatus.APPROVED },
        },
      }),
    ]);
    if (services + suggestions >= 20)
      throw new BadRequestException(
        'Mỗi hồ sơ được đăng ký tối đa 20 dịch vụ.',
      );
  }

  private async resetServiceCheck(
    transaction: Prisma.TransactionClient,
    applicationId: string,
  ) {
    await transaction.providerApplicationCheck.updateMany({
      where: { applicationId, section: ProviderApplicationSection.SERVICES },
      data: {
        status: ReviewStatus.PENDING,
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException('Dịch vụ này đã được đề xuất trong hồ sơ.');
    throw error;
  }
}
