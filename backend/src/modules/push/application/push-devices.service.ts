import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { RegisterPushDeviceDto } from '../dto/register-push-device.dto';

@Injectable()
export class PushDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    userId: string,
    sessionId: string,
    dto: RegisterPushDeviceDto,
  ) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const now = new Date();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const device = await this.prisma.$transaction(
          async (tx) => {
            await tx.userPushDevice.updateMany({
              where: {
                userId,
                platform: dto.platform,
                deviceId: dto.deviceId,
                tokenHash: { not: tokenHash },
                revokedAt: null,
              },
              data: { revokedAt: now },
            });
            return tx.userPushDevice.upsert({
              where: { tokenHash },
              create: {
                userId,
                sessionId,
                platform: dto.platform,
                deviceId: dto.deviceId,
                token: dto.token,
                tokenHash,
                appVersion: dto.appVersion,
                lastSeenAt: now,
              },
              update: {
                userId,
                sessionId,
                platform: dto.platform,
                deviceId: dto.deviceId,
                token: dto.token,
                appVersion: dto.appVersion,
                lastSeenAt: now,
                revokedAt: null,
              },
              select: {
                id: true,
                platform: true,
                deviceId: true,
                appVersion: true,
                lastSeenAt: true,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return { success: true, data: device };
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2002', 'P2034'].includes(error.code) ||
          attempt === 2
        )
          throw error;
      }
    }
    throw new Error('Unable to register push device');
  }

  async revoke(userId: string, id: string) {
    const result = await this.prisma.userPushDevice.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) {
      const own = await this.prisma.userPushDevice.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!own) throw new NotFoundException('Không tìm thấy thiết bị.');
    }
    return { success: true, data: null };
  }
}
