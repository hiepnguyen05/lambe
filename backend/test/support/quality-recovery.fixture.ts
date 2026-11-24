import { randomUUID } from 'node:crypto';
import type { ProviderProfile } from '@prisma/client';
import type { PrismaService } from '../../src/infrastructure/persistence/postgres/prisma.service';

export async function recoveryOrder(
  prisma: PrismaService,
  provider: Pick<ProviderProfile, 'id' | 'sourceApplicationId'>,
  customerId: string,
) {
  const suffix = randomUUID();
  const code = `QA_${suffix.replaceAll('-', '').toUpperCase()}`;
  const catalog = await prisma.service.create({
    data: {
      code,
      name: 'Recovery fixture',
      normalizedName: suffix,
      slug: suffix,
      minPriceAmount: 10000,
      maxPriceAmount: 1000000,
      status: 'ACTIVE',
      category: {
        create: {
          code,
          name: 'Recovery fixture',
          normalizedName: suffix,
          slug: suffix,
          status: 'ACTIVE',
        },
      },
    },
  });
  const offering = await prisma.providerService.create({
    data: {
      providerId: provider.id,
      serviceId: catalog.id,
      sourceApplicationId: provider.sourceApplicationId,
      priceAmount: 100000,
      durationMinutes: 60,
      status: 'ACTIVE',
    },
  });
  return prisma.serviceOrder.create({
    data: {
      customerId,
      providerId: provider.id,
      providerServiceId: offering.id,
      bookingType: 'SCHEDULED',
      status: 'ACCEPTED',
      expectedStartAt: new Date(Date.now() + 86_400_000),
      expectedEndAt: new Date(Date.now() + 90_000_000),
      serviceName: 'Recovery fixture',
      servicePriceAmount: 100000,
      totalAmount: 100000,
      durationMinutes: 60,
      commissionRateBps: 1000,
      commissionAmount: 10000,
      addressLabel: 'Test',
      addressLine: 'Test address',
      addressLatitude: 21.028,
      addressLongitude: 105.854,
      providerResponseDeadlineAt: new Date(Date.now() + 600000),
    },
  });
}
