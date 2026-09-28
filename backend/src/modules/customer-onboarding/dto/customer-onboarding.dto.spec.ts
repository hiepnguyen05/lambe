import 'reflect-metadata';
import {
  CustomerPricePreference,
  Gender,
  ServiceTargetAudience,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecommendationQueryDto } from './recommendation-query.dto';
import { UpdateCustomerOnboardingDto } from './update-customer-onboarding.dto';

describe('Customer onboarding DTOs', () => {
  it('accepts and transforms a complete onboarding payload', async () => {
    const dto = plainToInstance(UpdateCustomerOnboardingDto, {
      gender: Gender.MALE,
      preferredAudience: ServiceTargetAudience.MEN,
      pricePreference: CustomerPricePreference.BALANCED,
      categoryIds: ['6f0fb120-f590-4b63-8782-15ae57eeaba0'],
      serviceIds: ['4eb236b4-959d-45b9-a3f0-1f9c8c11f5e7'],
      defaultAddress: {
        label: ' Nhà ',
        addressLine: ' 12 Nguyễn Huệ, Quận 1 ',
        latitude: '10.7731',
        longitude: '106.703',
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.defaultAddress).toMatchObject({
      label: 'Nhà',
      addressLine: '12 Nguyễn Huệ, Quận 1',
      latitude: 10.7731,
      longitude: 106.703,
    });
  });

  it('rejects duplicate interests, invalid enums and coordinates', async () => {
    const duplicatedId = '6f0fb120-f590-4b63-8782-15ae57eeaba0';
    const dto = plainToInstance(UpdateCustomerOnboardingDto, {
      gender: 'UNKNOWN',
      preferredAudience: 'CHILDREN',
      categoryIds: [duplicatedId, duplicatedId],
      defaultAddress: {
        label: '',
        addressLine: 'x',
        latitude: 100,
        longitude: 200,
      },
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('validates and transforms recommendation limits', async () => {
    const valid = plainToInstance(RecommendationQueryDto, { limit: '10' });
    const invalid = plainToInstance(RecommendationQueryDto, { limit: 51 });
    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
    expect(valid.limit).toBe(10);
  });
});
