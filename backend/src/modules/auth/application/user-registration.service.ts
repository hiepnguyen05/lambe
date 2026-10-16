import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { toPublicUser } from './user.model';
import { UserTokenService } from './user-token.service';
import { UserSessionService } from './user-session.service';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';

@Injectable()
export class UserRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: UserTokenService,
    private readonly sessions: UserSessionService,
  ) {}

  async completeRegistration(
    dto: CompleteRegistrationDto,
    request: RequestMetadata = {},
  ) {
    const identity = await this.tokenService.verifyRegistrationToken(
      dto.registrationToken,
    );

    try {
      const newUser = await this.prisma.user.create({
        data: {
          phone: identity.phone,
          firebaseUid: identity.firebaseUid,
          fullName: dto.fullName,
          roles: { create: { role: UserRole.CUSTOMER } },
          customerProfile: { create: {} },
        },
        include: { roles: true, customerProfile: true },
      });

      const session = await this.sessions.create(
        newUser.id,
        newUser.phone,
        request,
      );
      return {
        success: true,
        message: 'Đăng ký tài khoản thành công.',
        data: {
          ...session,
          user: toPublicUser(newUser),
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Số điện thoại hoặc danh tính xác thực đã có tài khoản trên hệ thống.',
        );
      }

      throw error;
    }
  }
}
