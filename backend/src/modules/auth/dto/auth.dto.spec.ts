import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteRegistrationDto } from './complete-registration.dto';
import { SendOtpDto } from './send-otp.dto';
import { VerifyOtpDto } from './verify-otp.dto';

describe('public auth DTO validation', () => {
  it.each(['0363668951', '+84363668951', '84363668951'])(
    'accepts a supported Vietnamese phone format: %s',
    async (phone) => {
      const errors = await validate(plainToInstance(SendOtpDto, { phone }));
      expect(errors).toHaveLength(0);
    },
  );

  it.each(['', '123456', '0212345678', '036|668951', 363668951])(
    'rejects an invalid phone value: %s',
    async (phone) => {
      const errors = await validate(plainToInstance(SendOtpDto, { phone }));
      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it.each(['12345', '1234567', 'abcdef', '', 123456])(
    'rejects an invalid OTP value: %s',
    async (code) => {
      const errors = await validate(
        plainToInstance(VerifyOtpDto, { phone: '0363668951', code }),
      );
      expect(errors.some((error) => error.property === 'code')).toBe(true);
    },
  );

  it('accepts a six-digit OTP', async () => {
    const errors = await validate(
      plainToInstance(VerifyOtpDto, {
        phone: '0363668951',
        code: '123456',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('trims a valid registration name', async () => {
    const dto = plainToInstance(CompleteRegistrationDto, {
      registrationToken: 'token',
      fullName: '  Nguyen Van A  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.fullName).toBe('Nguyen Van A');
  });

  it.each(['', 'A', 'A'.repeat(101), 123])(
    'rejects an invalid registration name',
    async (fullName) => {
      const errors = await validate(
        plainToInstance(CompleteRegistrationDto, {
          registrationToken: 'token',
          fullName,
        }),
      );
      expect(errors.some((error) => error.property === 'fullName')).toBe(true);
    },
  );
});
