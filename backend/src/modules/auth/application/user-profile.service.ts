import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { toPublicUser } from './user.model';

@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, customerProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản hiện không hoạt động.');
    }

    const customerProfile =
      user.customerProfile ??
      (await this.prisma.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { onboardingStatus: true },
      }));

    return {
      success: true,
      data: { user: toPublicUser({ ...user, customerProfile }) },
    };
  }
}
