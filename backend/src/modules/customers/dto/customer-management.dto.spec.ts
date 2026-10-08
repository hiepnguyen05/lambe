import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserStatus } from '@prisma/client';
import {
  CustomerActivityQueryDto,
  CustomerQueryDto,
  UpdateCustomerStatusDto,
} from './customer-management.dto';

describe('Customer management DTOs', () => {
  it('converts valid list pagination and accepts filters', async () => {
    const dto = plainToInstance(CustomerQueryDto, {
      status: 'ACTIVE',
      gender: 'MALE',
      onboardingStatus: 'COMPLETED',
      providerStatus: 'ACTIVE',
      page: '2',
      limit: '50',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, limit: 50 });
  });

  it('rejects invalid filters and pagination', async () => {
    const dto = plainToInstance(CustomerQueryDto, {
      status: 'UNKNOWN',
      createdFrom: 'not-a-date',
      page: 0,
      limit: 101,
    });
    const errors = await validate(dto);

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(['status', 'createdFrom', 'page', 'limit']),
    );
  });

  it('requires a meaningful reason for status changes', async () => {
    const valid = plainToInstance(UpdateCustomerStatusDto, {
      status: UserStatus.BLOCKED,
      reason: 'Xác minh phản ánh từ khách hàng.',
    });
    const invalid = plainToInstance(UpdateCustomerStatusDto, {
      status: 'UNKNOWN',
      reason: 'ngắn',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });

  it('converts activity pagination', async () => {
    const dto = plainToInstance(CustomerActivityQueryDto, {
      page: '3',
      limit: '10',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 10 });
  });
});
