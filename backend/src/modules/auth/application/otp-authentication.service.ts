import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { normalizeVietnamesePhone } from '../../../common/utils/phone.util';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  SMS_SENDER,
  type SmsSender,
} from '../../../infrastructure/sms/sms-sender';
import type { SendOtpDto } from '../dto/send-otp.dto';
import type { VerifyOtpDto } from '../dto/verify-otp.dto';
import { toPublicUser } from './user.model';
import { UserTokenService } from './user-token.service';

const OTP_EXPIRES_IN_MS = 5 * 60 * 1000;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_OTP_SENDS_PER_WINDOW = 3;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class OtpAuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
    private readonly tokenService: UserTokenService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const phone = normalizeVietnamesePhone(dto.phone);
    const recentOtpCount = await this.prisma.otpCode.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - OTP_SEND_WINDOW_MS) },
      },
    });

    if (recentOtpCount >= MAX_OTP_SENDS_PER_WINDOW) {
      throw new HttpException(
        'Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau 10 phút.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    const code = randomInt(100000, 1000000).toString();
    const [, otpRecord] = await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { phone, isUsed: false, expiresAt: { gte: new Date() } },
        data: { isUsed: true },
      }),
      this.prisma.otpCode.create({
        data: {
          phone,
          codeHash: this.tokenService.hashOtp(phone, code),
          expiresAt: new Date(Date.now() + OTP_EXPIRES_IN_MS),
          type: existingUser ? 'LOGIN' : 'REGISTER',
        },
      }),
    ]);

    try {
      await this.smsSender.sendOtp(phone, code);
    } catch (error: unknown) {
      await this.prisma.otpCode.delete({ where: { id: otpRecord.id } });
      throw error;
    }

    return {
      success: true,
      message: 'Mã OTP đã được gửi thành công đến số điện thoại của bạn.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = normalizeVietnamesePhone(dto.phone);
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { phone, isUsed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
    }

    const submittedHash = this.tokenService.hashOtp(phone, dto.code);

    if (!this.tokenService.matchesOtp(otpRecord.codeHash, submittedHash)) {
      await this.registerFailedAttempt(otpRecord.id);
    }

    const updateResult = await this.prisma.otpCode.updateMany({
      where: {
        id: otpRecord.id,
        isUsed: false,
        attemptCount: { lt: MAX_OTP_ATTEMPTS },
      },
      data: { isUsed: true },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('Mã OTP đã được sử dụng.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      if (existingUser.status !== 'ACTIVE') {
        throw new ForbiddenException('Tài khoản hiện không hoạt động.');
      }

      return {
        success: true,
        isNewUser: false,
        message: 'Đăng nhập thành công.',
        data: {
          accessToken: this.tokenService.generateAccessToken(
            existingUser.id,
            phone,
          ),
          user: toPublicUser(existingUser),
        },
      };
    }

    return {
      success: true,
      isNewUser: true,
      message: 'Xác thực OTP thành công. Vui lòng hoàn tất đăng ký.',
      data: {
        phone,
        registrationToken: this.tokenService.generateRegistrationToken(phone),
      },
    };
  }

  private async registerFailedAttempt(otpId: string): Promise<never> {
    const updatedOtp = await this.prisma.otpCode.update({
      where: { id: otpId },
      data: { attemptCount: { increment: 1 } },
    });

    if (updatedOtp.attemptCount >= MAX_OTP_ATTEMPTS) {
      await this.prisma.otpCode.updateMany({
        where: { id: otpId, isUsed: false },
        data: { isUsed: true },
      });
      throw new HttpException(
        'Bạn đã nhập sai OTP quá nhiều lần. Vui lòng yêu cầu mã mới.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
  }
}
