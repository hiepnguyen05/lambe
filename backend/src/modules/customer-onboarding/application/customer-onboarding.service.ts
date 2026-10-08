import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CustomerOnboardingStatus,
  Prisma,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { UpdateCustomerOnboardingDto } from '../dto/update-customer-onboarding.dto';

const profileInclude = {
  categoryInterests: {
    select: {
      category: {
        select: { id: true, code: true, name: true, slug: true },
      },
    },
    orderBy: { category: { sortOrder: 'asc' as const } },
  },
  serviceInterests: {
    select: {
      service: {
        select: {
          id: true,
          code: true,
          name: true,
          slug: true,
          targetAudience: true,
          categoryId: true,
        },
      },
    },
    orderBy: { service: { sortOrder: 'asc' as const } },
  },
  user: {
    select: {
      customerAddresses: {
        where: { isDefault: true },
        take: 1,
        select: {
          id: true,
          type: true,
          label: true,
          addressLine: true,
          provinceName: true,
          districtName: true,
          wardName: true,
          streetLine: true,
          latitude: true,
          longitude: true,
          isMapConfirmed: true,
        },
      },
    },
  },
} satisfies Prisma.CustomerProfileInclude;

type ProfileWithPreferences = Prisma.CustomerProfileGetPayload<{
  include: typeof profileInclude;
}>;

@Injectable()
export class CustomerOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptions() {
    const categories = await this.prisma.serviceCategory.findMany({
      where: { status: ServiceCategoryStatus.ACTIVE },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        coverImageUrl: true,
        services: {
          where: { status: ServiceStatus.ACTIVE },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            code: true,
            name: true,
            slug: true,
            description: true,
            iconUrl: true,
            targetAudience: true,
            minPriceAmount: true,
            maxPriceAmount: true,
            currencyCode: true,
            defaultDurationMinutes: true,
          },
        },
      },
    });

    return { success: true, data: { categories } };
  }

  async getCurrent(userId: string) {
    const profile = await this.loadProfile(userId);
    return { success: true, data: this.toResponse(profile) };
  }

  async update(userId: string, dto: UpdateCustomerOnboardingDto) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'Cần cung cấp ít nhất một thông tin onboarding để cập nhật.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const profile = await transaction.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true, onboardingStatus: true },
      });

      await this.replaceCategoryInterests(
        transaction,
        profile.id,
        dto.categoryIds,
      );
      await this.replaceServiceInterests(
        transaction,
        profile.id,
        dto.serviceIds,
      );

      await transaction.customerProfile.update({
        where: { id: profile.id },
        data: {
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.preferredAudience !== undefined
            ? { preferredAudience: dto.preferredAudience }
            : {}),
          ...(dto.pricePreference !== undefined
            ? { pricePreference: dto.pricePreference }
            : {}),
          onboardingStatus:
            profile.onboardingStatus === CustomerOnboardingStatus.COMPLETED
              ? CustomerOnboardingStatus.COMPLETED
              : CustomerOnboardingStatus.IN_PROGRESS,
          skippedAt: null,
        },
      });

      if (dto.defaultAddress) {
        await this.saveDefaultAddress(transaction, userId, dto.defaultAddress);
      }
    });

    const profile = await this.loadProfile(userId);
    return {
      success: true,
      message: 'Đã lưu thông tin cá nhân hóa.',
      data: this.toResponse(profile),
    };
  }

  async complete(userId: string) {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });

    const activeCategoryCount =
      await this.prisma.customerCategoryInterest.count({
        where: {
          customerProfileId: profile.id,
          category: { status: ServiceCategoryStatus.ACTIVE },
        },
      });

    if (activeCategoryCount === 0) {
      throw new BadRequestException('Hãy chọn ít nhất một danh mục quan tâm.');
    }

    await this.prisma.customerProfile.update({
      where: { id: profile.id },
      data: {
        onboardingStatus: CustomerOnboardingStatus.COMPLETED,
        completedAt: new Date(),
        skippedAt: null,
      },
    });

    return {
      success: true,
      message: 'Hoàn tất cá nhân hóa tài khoản.',
      data: this.toResponse(await this.loadProfile(userId)),
    };
  }

  async skip(userId: string) {
    await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {
        onboardingStatus: CustomerOnboardingStatus.SKIPPED,
        completedAt: null,
        skippedAt: new Date(),
      },
      create: {
        userId,
        onboardingStatus: CustomerOnboardingStatus.SKIPPED,
        skippedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Đã bỏ qua onboarding. Bạn có thể hoàn thiện sau.',
      data: this.toResponse(await this.loadProfile(userId)),
    };
  }

  private loadProfile(userId: string): Promise<ProfileWithPreferences> {
    return this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: profileInclude,
    });
  }

  private async replaceCategoryInterests(
    transaction: Prisma.TransactionClient,
    customerProfileId: string,
    categoryIds?: string[],
  ): Promise<void> {
    if (categoryIds === undefined) return;

    const count = await transaction.serviceCategory.count({
      where: {
        id: { in: categoryIds },
        status: ServiceCategoryStatus.ACTIVE,
      },
    });
    if (count !== categoryIds.length) {
      throw new BadRequestException(
        'Danh sách danh mục chứa mục không tồn tại hoặc chưa hoạt động.',
      );
    }

    await transaction.customerCategoryInterest.deleteMany({
      where: { customerProfileId },
    });
    if (categoryIds.length) {
      await transaction.customerCategoryInterest.createMany({
        data: categoryIds.map((categoryId) => ({
          customerProfileId,
          categoryId,
        })),
      });
    }
  }

  private async replaceServiceInterests(
    transaction: Prisma.TransactionClient,
    customerProfileId: string,
    serviceIds?: string[],
  ): Promise<void> {
    if (serviceIds === undefined) return;

    const count = await transaction.service.count({
      where: {
        id: { in: serviceIds },
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
    });
    if (count !== serviceIds.length) {
      throw new BadRequestException(
        'Danh sách dịch vụ chứa mục không tồn tại hoặc chưa hoạt động.',
      );
    }

    await transaction.customerServiceInterest.deleteMany({
      where: { customerProfileId },
    });
    if (serviceIds.length) {
      await transaction.customerServiceInterest.createMany({
        data: serviceIds.map((serviceId) => ({
          customerProfileId,
          serviceId,
        })),
      });
    }
  }

  private async saveDefaultAddress(
    transaction: Prisma.TransactionClient,
    userId: string,
    address: NonNullable<UpdateCustomerOnboardingDto['defaultAddress']>,
  ): Promise<void> {
    const current = await transaction.customerAddress.findFirst({
      where: { userId, isDefault: true },
      select: { id: true },
    });
    const data = {
      type: address.type,
      label: address.label,
      addressLine: address.addressLine,
      provinceName: address.provinceName,
      districtName: address.districtName,
      wardName: address.wardName,
      streetLine: address.streetLine,
      latitude: address.latitude,
      longitude: address.longitude,
      isMapConfirmed: address.isMapConfirmed,
      isDefault: true,
    };

    if (current) {
      await transaction.customerAddress.update({
        where: { id: current.id },
        data,
      });
      return;
    }

    await transaction.customerAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    await transaction.customerAddress.create({
      data: { userId, ...data },
    });
  }

  private toResponse(profile: ProfileWithPreferences) {
    return {
      id: profile.id,
      gender: profile.gender,
      preferredAudience: profile.preferredAudience,
      pricePreference: profile.pricePreference,
      onboardingStatus: profile.onboardingStatus,
      completedAt: profile.completedAt,
      skippedAt: profile.skippedAt,
      categories: profile.categoryInterests.map((item) => item.category),
      services: profile.serviceInterests.map((item) => item.service),
      defaultAddress: profile.user.customerAddresses[0] ?? null,
      updatedAt: profile.updatedAt,
    };
  }
}
