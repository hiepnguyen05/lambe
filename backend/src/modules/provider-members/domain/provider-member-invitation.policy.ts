import { ConflictException } from '@nestjs/common';
import { ProviderMemberInvitationStatus } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_PENDING_INVITATIONS = 50;

export function createInvitationSecret() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function matchesInvitationToken(token: string, tokenHash: string) {
  const actual = Buffer.from(hashInvitationToken(token), 'hex');
  const expected = Buffer.from(tokenHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function effectiveInvitationStatus(invitation: {
  status: ProviderMemberInvitationStatus;
  expiresAt: Date;
}) {
  return invitation.status === ProviderMemberInvitationStatus.PENDING &&
    invitation.expiresAt <= new Date()
    ? ProviderMemberInvitationStatus.EXPIRED
    : invitation.status;
}

export function assertInvitationPending(invitation: {
  status: ProviderMemberInvitationStatus;
  expiresAt: Date;
}) {
  if (effectiveInvitationStatus(invitation) !== 'PENDING') {
    throw new ConflictException('Lời mời đã hết hạn hoặc đã được xử lý.');
  }
}
