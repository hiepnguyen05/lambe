import { NotFoundException } from '@nestjs/common';
import { PushPlatform } from '@prisma/client';
import { createHash } from 'crypto';
import { PushDevicesService } from './push-devices.service';

type UpdateCall = { where: Record<string, unknown>; data: { revokedAt: Date } };
type UpsertCall = {
  where: { tokenHash: string };
  update: { userId: string; sessionId: string; revokedAt: Date | null };
};

describe('PushDevicesService', () => {
  const dto = {
    platform: PushPlatform.ANDROID,
    deviceId: 'f532936a-793e-49cf-ab0e-f6f7c28ce583',
    token: 'fcm-registration-token-123456789',
    appVersion: '1.0.0',
  };
  const device = {
    id: 'device-id',
    platform: dto.platform,
    deviceId: dto.deviceId,
    appVersion: dto.appVersion,
    lastSeenAt: new Date(),
  };

  function setup() {
    const userPushDevice = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue(device),
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const prisma = {
      userPushDevice,
      $transaction: jest.fn(
        (
          callback: (tx: { userPushDevice: typeof userPushDevice }) => unknown,
        ) => callback({ userPushDevice }),
      ),
    };
    return {
      service: new PushDevicesService(prisma as never),
      userPushDevice,
    };
  }

  it('moves a token to the authenticated session and never returns it', async () => {
    const { service, userPushDevice } = setup();
    const result = await service.register('new-user', 'new-session', dto);
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const update = (
      userPushDevice.updateMany.mock.calls as unknown as Array<[UpdateCall]>
    )[0][0];
    const upsert = (
      userPushDevice.upsert.mock.calls as unknown as Array<[UpsertCall]>
    )[0][0];

    expect(update.where).toMatchObject({
      userId: 'new-user',
      platform: dto.platform,
      deviceId: dto.deviceId,
      tokenHash: { not: tokenHash },
      revokedAt: null,
    });
    expect(update.data.revokedAt).toBeInstanceOf(Date);
    expect(upsert.where).toEqual({ tokenHash });
    expect(upsert.update).toMatchObject({
      userId: 'new-user',
      sessionId: 'new-session',
      revokedAt: null,
    });
    expect(result).toEqual({ success: true, data: device });
    expect(JSON.stringify(result)).not.toContain(dto.token);
  });

  it('only revokes a device owned by the requester', async () => {
    const { service, userPushDevice } = setup();
    userPushDevice.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.revoke('other-user', 'device-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    const update = (
      userPushDevice.updateMany.mock.calls as unknown as Array<[UpdateCall]>
    )[0][0];
    expect(update.where).toEqual({
      id: 'device-id',
      userId: 'other-user',
      revokedAt: null,
    });
    expect(update.data.revokedAt).toBeInstanceOf(Date);
    expect(userPushDevice.findFirst).toHaveBeenCalledWith({
      where: { id: 'device-id', userId: 'other-user' },
      select: { id: true },
    });
  });
});
