import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateProviderMemberInvitationDto,
  ProviderMembersQueryDto,
  RespondProviderMemberInvitationDto,
} from './provider-members.dto';

describe('Provider member DTOs', () => {
  it.each(['0912345678', '+84 912 345 678', '84912345678'])(
    'normalizes %s to the account phone format',
    async (phone) => {
      const dto = plainToInstance(CreateProviderMemberInvitationDto, { phone });
      expect(dto.phone).toBe('0912345678');
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it('rejects extra role/status fields and malformed secrets', async () => {
    const input = plainToInstance(CreateProviderMemberInvitationDto, {
      phone: '0912345678',
      role: 'OWNER',
    });
    expect(
      await validate(input, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toHaveLength(0);
    const token = plainToInstance(RespondProviderMemberInvitationDto, {
      token: 'guess',
    });
    expect(await validate(token)).not.toHaveLength(0);
  });

  it('bounds pagination work', async () => {
    const query = plainToInstance(ProviderMembersQueryDto, {
      page: 1001,
      limit: 51,
    });
    expect(await validate(query)).toHaveLength(2);
  });
});
