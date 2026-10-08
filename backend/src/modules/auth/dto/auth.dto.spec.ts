import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteRegistrationDto } from './complete-registration.dto';
import { CheckFirebasePhoneLinkDto } from './check-firebase-phone-link.dto';
import { ExchangeFirebaseTokenDto } from './exchange-firebase-token.dto';
import { UpdateCurrentUserProfileDto } from './update-current-user-profile.dto';

describe('public auth DTO validation', () => {
  it('accepts a Firebase ID token with a valid length', async () => {
    const errors = await validate(
      plainToInstance(ExchangeFirebaseTokenDto, { idToken: 'x'.repeat(100) }),
    );
    expect(errors).toHaveLength(0);
  });

  it.each(['', 'short-token', 123])(
    'rejects an invalid Firebase ID token: %s',
    async (idToken) => {
      const errors = await validate(
        plainToInstance(ExchangeFirebaseTokenDto, { idToken }),
      );
      expect(errors.length).toBeGreaterThan(0);
    },
  );

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

  it('normalizes a valid phone for Firebase phone-link pre-check', async () => {
    const dto = plainToInstance(CheckFirebasePhoneLinkDto, {
      idToken: 'x'.repeat(100),
      phone: '+84363668951',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.phone).toBe('0363668951');
  });

  it.each(['', '123', '+84123456789', '036366895', 123])(
    'rejects an invalid phone-link pre-check phone: %s',
    async (phone) => {
      const errors = await validate(
        plainToInstance(CheckFirebasePhoneLinkDto, {
          idToken: 'x'.repeat(100),
          phone,
        }),
      );
      expect(errors.some((error) => error.property === 'phone')).toBe(true);
    },
  );

  it('accepts a valid current user profile update', async () => {
    const dto = plainToInstance(UpdateCurrentUserProfileDto, {
      fullName: '  Nguyen Van B  ',
      gender: 'MALE',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.fullName).toBe('Nguyen Van B');
  });

  it.each(['A', 'A'.repeat(101), 123])(
    'rejects an invalid profile name: %s',
    async (fullName) => {
      const errors = await validate(
        plainToInstance(UpdateCurrentUserProfileDto, { fullName }),
      );
      expect(errors.some((error) => error.property === 'fullName')).toBe(true);
    },
  );

  it('rejects an invalid profile gender', async () => {
    const errors = await validate(
      plainToInstance(UpdateCurrentUserProfileDto, { gender: 'UNKNOWN' }),
    );

    expect(errors.some((error) => error.property === 'gender')).toBe(true);
  });
});
