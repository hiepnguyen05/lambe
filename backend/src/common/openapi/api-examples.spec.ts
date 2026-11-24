import {
  adminCategorySelect,
  publicCategorySelect,
} from '../../modules/categories/application/category.select';
import {
  adminServiceSelect,
  publicServiceSelect,
} from '../../modules/services/application/service.select';
import {
  adminCategoryExample,
  adminServiceExample,
  categoryExample,
  serviceExample,
} from './api-examples';

describe('category OpenAPI examples', () => {
  it('matches the public and admin database projections', () => {
    expect(Object.keys(categoryExample).sort()).toEqual(
      Object.keys(publicCategorySelect).sort(),
    );
    expect(Object.keys(adminCategoryExample).sort()).toEqual(
      Object.keys(adminCategorySelect).sort(),
    );
  });
});

describe('service OpenAPI examples', () => {
  it('matches the public service fields selected from the database', () => {
    expect(Object.keys(serviceExample).sort()).toEqual(
      Object.keys(publicServiceSelect).sort(),
    );
    expect(Object.keys(serviceExample.category).sort()).toEqual(
      Object.keys(publicServiceSelect.category.select).sort(),
    );
  });

  it('matches the admin service fields selected from the database', () => {
    expect(Object.keys(adminServiceExample).sort()).toEqual(
      Object.keys(adminServiceSelect).sort(),
    );
    expect(Object.keys(adminServiceExample.category).sort()).toEqual(
      Object.keys(adminServiceSelect.category.select).sort(),
    );
  });
});
