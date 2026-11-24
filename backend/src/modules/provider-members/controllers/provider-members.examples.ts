export const memberExample = {
  id: '7c757a98-901c-4ee9-97c5-49042b470cdc',
  providerId: 'ff9beef6-2bad-49bd-a4e0-9d46d67e0f4c',
  userId: '26bb96c6-a84b-41cd-859d-e752c4d4fdc9',
  role: 'WORKER',
  status: 'PENDING_VERIFICATION',
  canProvideServices: true,
  membershipVersion: 1,
  displayName: 'Nguyễn Văn An',
  avatarUrl: null,
  joinedAt: '2026-10-27T09:00:00.000Z',
  leftAt: null,
};

export const invitationExample = {
  id: 'c1aeffcd-0e68-4f9f-8da8-2e60cb7334dc',
  providerId: memberExample.providerId,
  phone: '0912345678',
  status: 'PENDING',
  expiresAt: '2026-11-03T09:00:00.000Z',
  respondedAt: null,
  revokedAt: null,
  lastSentAt: '2026-10-27T09:00:00.000Z',
  createdAt: '2026-10-27T09:00:00.000Z',
};
