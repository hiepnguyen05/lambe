import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InternalLoginDto } from './internal-login.dto';

describe('InternalLoginDto', () => {
  it('accepts a valid username and strong passphrase', async () => {
    const errors = await validate(
      plainToInstance(InternalLoginDto, {
        username: 'admin',
        password: 'A-strong-admin-password-2026',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['', 'A-strong-admin-password-2026'],
    ['ab', 'A-strong-admin-password-2026'],
    ['a'.repeat(65), 'A-strong-admin-password-2026'],
    ['admin', 'short-password'],
    ['admin', 'a'.repeat(129)],
  ])('rejects invalid internal credentials', async (username, password) => {
    const errors = await validate(
      plainToInstance(InternalLoginDto, { username, password }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
