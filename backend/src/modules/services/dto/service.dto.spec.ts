import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
import { PublicServiceQueryDto } from './public-service-query.dto';
import { ReorderServicesDto } from './reorder-services.dto';
import { ServiceQueryDto } from './service-query.dto';
import { ServiceSlugParamDto } from './service-slug-param.dto';
import {
  normalizeServiceCode,
  normalizeServiceSlug,
  trimString,
} from './service-transformers';
import { UpdateServiceStatusDto } from './update-service-status.dto';
import { UpdateServiceDto } from './update-service.dto';

describe('Service DTOs', () => {
  it('normalizes and validates create input', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      categoryId: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
      code: ' men_haircut ',
      name: ' Cắt tóc nam ',
      slug: ' CAT-TOC-NAM ',
      minPriceAmount: '50000',
      maxPriceAmount: '300000',
      defaultDurationMinutes: '45',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      code: 'MEN_HAIRCUT',
      name: 'Cắt tóc nam',
      slug: 'cat-toc-nam',
      minPriceAmount: 50000,
      maxPriceAmount: 300000,
      defaultDurationMinutes: 45,
    });
  });

  it.each([
    { minPriceAmount: 0, maxPriceAmount: 100000 },
    { minPriceAmount: 50000, maxPriceAmount: 2_000_000_001 },
    {
      minPriceAmount: 50000,
      maxPriceAmount: 100000,
      defaultDurationMinutes: 5,
    },
  ])('rejects invalid numeric boundaries', async (prices) => {
    const dto = plainToInstance(CreateServiceDto, {
      categoryId: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
      code: 'MEN_HAIRCUT',
      name: 'Cắt tóc nam',
      slug: 'cat-toc-nam',
      ...prices,
    });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('does not expose immutable or cover image fields on update', async () => {
    const dto = plainToInstance(UpdateServiceDto, {
      name: ' Cắt tóc nữ ',
      code: 'CHANGED',
      categoryId: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
      status: 'ACTIVE',
      coverImageUrl: 'https://example.test/unmanaged.webp',
    });
    await validate(dto, { whitelist: true });
    expect(dto.name).toBe('Cắt tóc nữ');
    expect(dto).not.toHaveProperty('code');
    expect(dto).not.toHaveProperty('categoryId');
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('coverImageUrl');
  });

  it('validates admin filters and pagination', async () => {
    const valid = plainToInstance(ServiceQueryDto, {
      categoryId: '6f0fb120-f590-4b63-8782-15ae57eeaba0',
      status: 'ACTIVE',
      page: '2',
      limit: '50',
    });
    const invalid = plainToInstance(ServiceQueryDto, {
      categoryId: 'invalid',
      status: 'UNKNOWN',
      page: 0,
      limit: 101,
    });
    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
    expect(valid).toMatchObject({ page: 2, limit: 50 });
  });

  it('normalizes and validates public query and slug parameters', async () => {
    const query = plainToInstance(PublicServiceQueryDto, {
      categorySlug: ' TOC ',
    });
    const slug = plainToInstance(ServiceSlugParamDto, {
      slug: ' CAT-TOC-NAM ',
    });
    const invalid = plainToInstance(ServiceSlugParamDto, {
      slug: 'invalid_slug',
    });
    await expect(validate(query)).resolves.toHaveLength(0);
    await expect(validate(slug)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
    expect(query.categorySlug).toBe('toc');
    expect(slug.slug).toBe('cat-toc-nam');
  });

  it('validates reorder items and status values', async () => {
    const reorder = plainToInstance(ReorderServicesDto, {
      items: [{ id: '4eb236b4-959d-45b9-a3f0-1f9c8c11f5e7', sortOrder: '1' }],
    });
    const invalidReorder = plainToInstance(ReorderServicesDto, {
      items: [{ id: 'invalid', sortOrder: -1 }],
    });
    const status = plainToInstance(UpdateServiceStatusDto, {
      status: 'ACTIVE',
    });
    const invalidStatus = plainToInstance(UpdateServiceStatusDto, {
      status: 'UNKNOWN',
    });
    await expect(validate(reorder)).resolves.toHaveLength(0);
    await expect(validate(invalidReorder)).resolves.not.toHaveLength(0);
    await expect(validate(status)).resolves.toHaveLength(0);
    await expect(validate(invalidStatus)).resolves.not.toHaveLength(0);
  });

  it('leaves non-string transformer input untouched', () => {
    expect(trimString({ value: 1 })).toBe(1);
    expect(normalizeServiceCode({ value: 1 })).toBe(1);
    expect(normalizeServiceSlug({ value: 1 })).toBe(1);
  });
});
