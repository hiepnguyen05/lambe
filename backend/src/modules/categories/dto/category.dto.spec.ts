import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CategoryQueryDto } from './category-query.dto';
import { CategorySlugParamDto } from './category-slug-param.dto';
import { CreateCategoryDto } from './create-category.dto';
import { ReorderCategoriesDto } from './reorder-categories.dto';
import { UpdateCategoryDto } from './update-category.dto';

describe('Category DTOs', () => {
  it('normalizes valid create input', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      code: ' hair ',
      name: ' Tóc ',
      slug: ' TOC ',
      iconUrl: 'content_cut',
      sortOrder: '2',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      code: 'HAIR',
      name: 'Tóc',
      slug: 'toc',
      iconUrl: 'content_cut',
      sortOrder: 2,
    });
  });

  it.each([
    [{ code: '1HAIR', name: 'Tóc', slug: 'toc' }, 'code'],
    [{ code: 'H', name: 'Tóc', slug: 'toc' }, 'code'],
    [{ code: 'HAIR', name: 'Tóc', slug: '-toc-' }, 'slug'],
    [{ code: 'HAIR', name: 'Tóc', slug: 'toc', sortOrder: -1 }, 'sortOrder'],
    [
      { code: 'HAIR', name: 'Tóc', slug: 'toc', iconUrl: 'not-a-url' },
      'iconUrl',
    ],
  ])('rejects invalid create input for %s', async (input, property) => {
    const errors = await validate(plainToInstance(CreateCategoryDto, input));
    expect(errors.some((error) => error.property === property)).toBe(true);
  });

  it('does not expose immutable code or status fields on update', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      name: ' Nail ',
      code: 'NAIL',
      status: 'ACTIVE',
      coverImageUrl: 'https://example.test/unmanaged.webp',
    });
    const errors = await validate(dto, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Nail');
    expect(dto).not.toHaveProperty('code');
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('coverImageUrl');
  });

  it('normalizes and validates a public category slug parameter', async () => {
    const valid = plainToInstance(CategorySlugParamDto, { slug: ' TOC-NAM ' });
    const invalid = plainToInstance(CategorySlugParamDto, {
      slug: 'invalid_slug',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
    expect(valid.slug).toBe('toc-nam');
  });

  it('converts and validates query pagination', async () => {
    const dto = plainToInstance(CategoryQueryDto, {
      page: '2',
      limit: '50',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, limit: 50 });
  });

  it('validates every reorder item', async () => {
    const valid = plainToInstance(ReorderCategoriesDto, {
      items: [{ id: '6f0fb120-f590-4b63-8782-15ae57eeaba0', sortOrder: '1' }],
    });
    const invalid = plainToInstance(ReorderCategoriesDto, {
      items: [{ id: 'not-a-uuid', sortOrder: -1 }],
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
