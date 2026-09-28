import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderApplicationSection,
  ReviewStatus,
  ServiceStatus,
  ServiceCategoryStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  AddProviderApplicationServiceDto,
  UpdateProviderApplicationServiceDto,
} from '../../dto/provider-application-service.dto';
import {
  assertApplicationEditable,
  assertProviderSectionsEditable,
} from '../../domain/provider-application.policy';
import { lockProviderApplication } from '../persistence/provider-application-lock';
import { serviceSummarySelect } from '../persistence/provider-application.select';

const resetReviewData = {
  status: ReviewStatus.PENDING,
  reviewNote: null,
  reviewedById: null,
  reviewedAt: null,
};

@Injectable()
export class ProviderApplicationServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(
    applicationId: string,
    userId: string,
    dto: AddProviderApplicationServiceDto,
  ) {
    try {
      const item = await this.prisma.$transaction(async (transaction) => {
        const application = await this.findEditable(
          transaction,
          applicationId,
          userId,
        );
        assertProviderSectionsEditable(application, [
          ProviderApplicationSection.SERVICES,
        ]);
        await this.assertServiceAndPrice(
          transaction,
          dto.serviceId,
          dto.proposedPriceAmount,
        );
        if (
          (await transaction.providerApplicationService.count({
            where: { applicationId },
          })) >= 20
        )
          throw new BadRequestException(
            'Mỗi hồ sơ được đăng ký tối đa 20 dịch vụ.',
          );
        const created = await transaction.providerApplicationService.create({
          data: { applicationId, ...dto },
          include: { service: { select: serviceSummarySelect } },
        });
        await this.resetCheck(transaction, applicationId);
        return created;
      });
      return {
        success: true,
        message: 'Đã thêm dịch vụ vào hồ sơ.',
        data: item,
      };
    } catch (error: unknown) {
      this.rethrowWriteError(error);
    }
  }

  async update(
    applicationId: string,
    itemId: string,
    userId: string,
    dto: UpdateProviderApplicationServiceDto,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('Không có dữ liệu dịch vụ cần cập nhật.');
    try {
      const item = await this.prisma.$transaction(async (transaction) => {
        const application = await this.findEditable(
          transaction,
          applicationId,
          userId,
        );
        const current = await transaction.providerApplicationService.findFirst({
          where: { id: itemId, applicationId },
          include: { _count: { select: { documents: true } } },
        });
        if (!current)
          throw new NotFoundException('Không tìm thấy dịch vụ đã đăng ký.');
        assertProviderSectionsEditable(
          application,
          [ProviderApplicationSection.SERVICES],
          current.status === ReviewStatus.NEEDS_CHANGES,
        );
        if (
          dto.serviceId &&
          dto.serviceId !== current.serviceId &&
          current._count.documents > 0
        )
          throw new BadRequestException(
            'Không thể đổi dịch vụ khi còn chứng chỉ hoặc portfolio liên kết.',
          );
        await this.assertServiceAndPrice(
          transaction,
          dto.serviceId ?? current.serviceId,
          dto.proposedPriceAmount ?? current.proposedPriceAmount,
        );
        const updated = await transaction.providerApplicationService.update({
          where: { id: itemId },
          data: { ...dto, ...resetReviewData },
          include: { service: { select: serviceSummarySelect } },
        });
        await this.resetCheck(transaction, applicationId);
        return updated;
      });
      return {
        success: true,
        message: 'Đã cập nhật dịch vụ đăng ký.',
        data: item,
      };
    } catch (error: unknown) {
      this.rethrowWriteError(error);
    }
  }

  async remove(applicationId: string, itemId: string, userId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const application = await this.findEditable(
        transaction,
        applicationId,
        userId,
      );
      const item = await transaction.providerApplicationService.findFirst({
        where: { id: itemId, applicationId },
        select: { status: true, _count: { select: { documents: true } } },
      });
      if (!item)
        throw new NotFoundException('Không tìm thấy dịch vụ đã đăng ký.');
      assertProviderSectionsEditable(
        application,
        [ProviderApplicationSection.SERVICES],
        item.status === ReviewStatus.NEEDS_CHANGES,
      );
      if (item._count.documents)
        throw new BadRequestException(
          'Hãy xóa chứng chỉ và portfolio gắn với dịch vụ trước.',
        );
      await transaction.providerApplicationService.deleteMany({
        where: { id: itemId, applicationId },
      });
      await this.resetCheck(transaction, applicationId);
    });
    return { success: true, message: 'Đã xóa dịch vụ khỏi hồ sơ.' };
  }

  private async findEditable(
    transaction: Prisma.TransactionClient,
    id: string,
    userId: string,
  ) {
    await lockProviderApplication(transaction, id, userId);
    const application = await transaction.providerApplication.findFirst({
      where: { id, userId },
      include: { checks: true },
    });
    if (!application)
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    assertApplicationEditable(application.status);
    return application;
  }

  private async assertServiceAndPrice(
    transaction: Prisma.TransactionClient,
    id: string,
    price: number,
  ): Promise<void> {
    const service = await transaction.service.findFirst({
      where: {
        id,
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
    });
    if (!service)
      throw new BadRequestException(
        'Dịch vụ không tồn tại hoặc chưa hoạt động.',
      );
    if (price < service.minPriceAmount || price > service.maxPriceAmount)
      throw new BadRequestException(
        `Giá đề xuất phải nằm trong khoảng ${service.minPriceAmount} - ${service.maxPriceAmount} VND.`,
      );
  }

  private async resetCheck(
    transaction: Prisma.TransactionClient,
    applicationId: string,
  ): Promise<void> {
    await transaction.providerApplicationCheck.updateMany({
      where: { applicationId, section: ProviderApplicationSection.SERVICES },
      data: resetReviewData,
    });
  }

  private rethrowWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException('Dịch vụ này đã có trong hồ sơ.');
    throw error;
  }
}
