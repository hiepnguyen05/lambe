import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateProviderServiceChangeDto } from './provider-service-change.dto';

describe('UpdateProviderServiceChangeDto', () => {
  it.each(['proposedPriceAmount', 'name', 'categoryId'])(
    'rejects null for %s instead of passing it to persistence',
    (field) => {
      const dto = plainToInstance(UpdateProviderServiceChangeDto, {
        [field]: null,
      });
      expect(validateSync(dto).map((error) => error.property)).toContain(field);
    },
  );
});
