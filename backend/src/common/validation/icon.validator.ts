import { isURL, ValidateBy, type ValidationOptions } from 'class-validator';

const MATERIAL_SYMBOL_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;

export function IsIcon(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isIcon',
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            (MATERIAL_SYMBOL_PATTERN.test(value) ||
              isURL(value, {
                protocols: ['https'],
                require_protocol: true,
              }))
          );
        },
        defaultMessage(): string {
          return 'Icon phải là mã Material Symbol hoặc URL HTTPS hợp lệ.';
        },
      },
    },
    validationOptions,
  );
}
