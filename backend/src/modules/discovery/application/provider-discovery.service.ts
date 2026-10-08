import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  UserStatus,
} from '@prisma/client';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderSearchDto } from '../dto/provider-search.dto';
import { calculateDistanceKm } from '../domain/distance';

@Injectable()
export class ProviderDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
  ) {}

  async search(userId: string, dto: ProviderSearchDto) {
    const origin = await this.resolveOrigin(userId, dto);
    const radiusKm = dto.radiusKm ?? 10;
    const limit = dto.limit ?? 20;
    const candidates = await this.locations.findNearby(
      origin.latitude,
      origin.longitude,
      radiusKm,
      Math.min(limit * 5, 100),
    );
    if (!candidates.length) {
      return { success: true, data: [], meta: { radiusKm, count: 0 } };
    }

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        id: { in: candidates.map((item) => item.providerId) },
        status: ProviderProfileStatus.ACTIVE,
        setupCompletedAt: { not: null },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        providerType: true,
        displayName: true,
        avatarUrl: true,
        biography: true,
        experienceYears: true,
        serviceAreaName: true,
        serviceAreaLatitude: true,
        serviceAreaLongitude: true,
        serviceRadiusKm: true,
        services: {
          where: {
            serviceId: dto.serviceId,
            status: ProviderServiceStatus.ACTIVE,
            service: {
              status: ServiceStatus.ACTIVE,
              category: { status: ServiceCategoryStatus.ACTIVE },
            },
          },
          take: 1,
          select: {
            id: true,
            priceAmount: true,
            durationMinutes: true,
            description: true,
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                currencyCode: true,
                targetAudience: true,
              },
            },
          },
        },
      },
    });
    const providerMap = new Map(
      providers.map((provider) => [provider.id, provider]),
    );

    const data = candidates
      .flatMap((candidate) => {
        const provider = providerMap.get(candidate.providerId);
        if (
          !provider ||
          provider.services.length === 0 ||
          provider.serviceAreaLatitude === null ||
          provider.serviceAreaLongitude === null ||
          provider.serviceRadiusKm === null
        ) {
          return [];
        }

        const distanceFromServiceAreaKm = calculateDistanceKm(origin, {
          latitude: provider.serviceAreaLatitude,
          longitude: provider.serviceAreaLongitude,
        });
        if (distanceFromServiceAreaKm > provider.serviceRadiusKm) return [];

        return [
          {
            id: provider.id,
            providerType: provider.providerType,
            displayName: provider.displayName,
            avatarUrl: provider.avatarUrl,
            biography: provider.biography,
            experienceYears: provider.experienceYears,
            serviceAreaName: provider.serviceAreaName,
            distanceKm: Math.round(candidate.distanceKm * 10) / 10,
            service: provider.services[0],
          },
        ];
      })
      .slice(0, limit);

    return {
      success: true,
      data,
      meta: { radiusKm, count: data.length },
    };
  }

  async findPublicProfile(providerId: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: providerId,
        status: ProviderProfileStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        providerType: true,
        displayName: true,
        avatarUrl: true,
        biography: true,
        experienceYears: true,
        serviceAreaName: true,
        workingHours: {
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
          select: { dayOfWeek: true, startMinute: true, endMinute: true },
        },
        services: {
          where: {
            status: ProviderServiceStatus.ACTIVE,
            service: {
              status: ServiceStatus.ACTIVE,
              category: { status: ServiceCategoryStatus.ACTIVE },
            },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            priceAmount: true,
            durationMinutes: true,
            description: true,
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                coverImageUrl: true,
                currencyCode: true,
                targetAudience: true,
                category: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException(
        'Không tìm thấy nhà cung cấp đang hoạt động.',
      );
    }
    const online = await this.locations
      .isOnline(provider.id)
      .catch(() => false);
    return { success: true, data: { ...provider, online } };
  }

  private async resolveOrigin(userId: string, dto: ProviderSearchDto) {
    if (dto.customerAddressId) {
      const address = await this.prisma.customerAddress.findFirst({
        where: { id: dto.customerAddressId, userId },
        select: { latitude: true, longitude: true },
      });
      if (!address)
        throw new NotFoundException('Không tìm thấy địa chỉ của khách hàng.');
      return address;
    }

    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw new BadRequestException(
        'Cần cung cấp customerAddressId hoặc đầy đủ latitude và longitude.',
      );
    }
    return { latitude: dto.latitude, longitude: dto.longitude };
  }
}
