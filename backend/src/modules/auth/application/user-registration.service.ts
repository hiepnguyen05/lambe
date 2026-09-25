import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { toPublicUser } from './user.model';
import { UserTokenService } from './user-token.service';

@Injectable()
export class UserRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: UserTokenService,
  ) {}

  async completeRegistration(dto: CompleteRegistrationDto) {
    const phone = await this.tokenService.verifyRegistrationToken(
      dto.registrationToken,
    );

    try {
      const newUser = await this.prisma.user.create({
        data: { phone, fullName: dto.fullName },
      });

      return {
        success: true,
        message: 'Đăng ký tài khoản thành công.',
        data: {
          accessToken: this.tokenService.generateAccessToken(
            newUser.id,
            newUser.phone,
          ),
          user: toPublicUser(newUser),
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Số điện thoại này đã có tài khoản trên hệ thống.',
        );
      }

      throw error;
    }
  }
}
