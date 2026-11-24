import { ConflictException } from '@nestjs/common';
import {
  assertInvitationPending,
  createInvitationSecret,
  effectiveInvitationStatus,
  matchesInvitationToken,
} from './provider-member-invitation.policy';

describe('Provider member invitation secrets', () => {
  it('uses independent random secrets and stores only a hash', () => {
    const first = createInvitationSecret();
    const second = createInvitationSecret();
    expect(first.token).toMatch(/^[0-9a-f]{64}$/);
    expect(first.tokenHash).not.toBe(first.token);
    expect(first.token).not.toBe(second.token);
    expect(matchesInvitationToken(first.token, first.tokenHash)).toBe(true);
    expect(matchesInvitationToken(second.token, first.tokenHash)).toBe(false);
    expect(matchesInvitationToken(first.token, 'malformed')).toBe(false);
  });

  it('treats an expired pending row as expired even before cleanup', () => {
    const invitation = {
      status: 'PENDING' as const,
      expiresAt: new Date(Date.now() - 1),
    };
    expect(effectiveInvitationStatus(invitation)).toBe('EXPIRED');
    expect(() => assertInvitationPending(invitation)).toThrow(
      ConflictException,
    );
  });
});
