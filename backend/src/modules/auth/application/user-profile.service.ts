import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../upload/application/media-storage.port';
import type { UpdateCurrentUserProfileDto } from '../dto/update-current-user-profile.dto';
import { toPublicUser } from './user.model';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
  ) {}

  async getCurrentUser(userId: string) {
    const user = await this.findActiveUser(userId);

    const customerProfile =
      user.customerProfile ??
      (await this.prisma.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: {
          gender: true,
          preferredAudience: true,
          pricePreference: true,
          onboardingStatus: true,
        },
      }));

    return {
      success: true,
      data: { user: toPublicUser({ ...user, customerProfile }) },
    };
  }

  async updateCurrentUser(
    userId: string,
    dto: UpdateCurrentUserProfileDto,
    request: RequestMetadata = {},
  ) {
    const shouldUpdateName = dto.fullName !== undefined;
    const shouldUpdateGender = Object.prototype.hasOwnProperty.call(
      dto,
      'gender',
    );

    if (!shouldUpdateName && !shouldUpdateGender) {
      throw new BadRequestException('Khong co thong tin nao de cap nhat.');
    }

    await this.findActiveUser(userId);

    const user = await this.prisma.$transaction(async (transaction) => {
      if (shouldUpdateName) {
        await transaction.user.update({
          where: { id: userId },
          data: { fullName: dto.fullName },
        });
      }

      if (shouldUpdateGender) {
        await transaction.customerProfile.upsert({
          where: { userId },
          update: { gender: dto.gender ?? null },
          create: { userId, gender: dto.gender ?? null },
        });
      }

      const updated = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        include: { roles: true, customerProfile: true },
      });

      await this.auditService.record(
        {
          actorUserId: userId,
          action: 'USER_PROFILE_UPDATED',
          resourceType: 'User',
          resourceId: userId,
          result: 'SUCCESS',
          metadata: {
            changedFields: [
              ...(shouldUpdateName ? ['fullName'] : []),
              ...(shouldUpdateGender ? ['gender'] : []),
            ],
          },
        },
        request,
        transaction,
      );

      return updated;
    });

    return {
      success: true,
      message: 'Cap nhat ho so ca nhan thanh cong.',
      data: { user: toPublicUser(user) },
    };
  }

  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    request: RequestMetadata = {},
  ) {
    const existing = await this.findActiveUser(userId);
    const uploaded = await this.mediaStorage.uploadImage(
      buffer,
      `lambe/users/${userId}/avatar`,
    );

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const write = await transaction.user.updateMany({
          where: { id: userId, updatedAt: existing.updatedAt },
          data: {
            avatarUrl: uploaded.secureUrl,
            avatarPublicId: uploaded.publicId,
          },
        });

        if (write.count !== 1) {
          throw new ConflictException(
            'Ho so vua duoc cap nhat. Vui long tai lai va thu lai.',
          );
        }

        const updated = await transaction.user.findUniqueOrThrow({
          where: { id: userId },
          include: { roles: true, customerProfile: true },
        });

        await this.auditService.record(
          {
            actorUserId: userId,
            action: 'USER_AVATAR_UPDATED',
            resourceType: 'User',
            resourceId: userId,
            result: 'SUCCESS',
            metadata: { imagePublicId: uploaded.publicId },
          },
          request,
          transaction,
        );

        return updated;
      });

      if (
        existing.avatarPublicId &&
        existing.avatarPublicId !== uploaded.publicId
      ) {
        await this.deleteManagedImage(existing.avatarPublicId);
      }

      return {
        success: true,
        message: 'Cap nhat anh dai dien thanh cong.',
        data: { user: toPublicUser(user) },
      };
    } catch (error: unknown) {
      await this.deleteManagedImage(uploaded.publicId);
      throw error;
    }
  }

  async removeAvatar(userId: string, request: RequestMetadata = {}) {
    const existing = await this.findActiveUser(userId);

    if (!existing.avatarUrl) {
      throw new BadRequestException('Tai khoan chua co anh dai dien.');
    }

    const user = await this.prisma.$transaction(async (transaction) => {
      const write = await transaction.user.updateMany({
        where: { id: userId, updatedAt: existing.updatedAt },
        data: { avatarUrl: null, avatarPublicId: null },
      });

      if (write.count !== 1) {
        throw new ConflictException(
          'Ho so vua duoc cap nhat. Vui long tai lai va thu lai.',
        );
      }

      const updated = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        include: { roles: true, customerProfile: true },
      });

      await this.auditService.record(
        {
          actorUserId: userId,
          action: 'USER_AVATAR_REMOVED',
          resourceType: 'User',
          resourceId: userId,
          result: 'SUCCESS',
          metadata: { imagePublicId: existing.avatarPublicId },
        },
        request,
        transaction,
      );

      return updated;
    });

    if (existing.avatarPublicId) {
      await this.deleteManagedImage(existing.avatarPublicId);
    }

    return {
      success: true,
      message: 'Xoa anh dai dien thanh cong.',
      data: { user: toPublicUser(user) },
    };
  }

  private async findActiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, customerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Khong tim thay tai khoan.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tai khoan hien khong hoat dong.');
    }

    return user;
  }

  private async deleteManagedImage(publicId: string): Promise<void> {
    try {
      const deleted = await this.mediaStorage.deleteImage(publicId);
      if (!deleted) {
        this.logger.warn(`Cloud image was not deleted: ${publicId}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Cloud image cleanup failed for ${publicId}: ${message}`,
      );
    }
  }
}
