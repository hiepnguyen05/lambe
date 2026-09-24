import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { normalizeVietnamesePhone } from '../../../common/utils/phone.util';
import {
  SMS_SENDER,
  type SmsSender,
} from '../../../infrastructure/sms/sms-sender';
import { PrismaService } from '../../database/prisma.service';
import { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';

interface RegistrationTokenPayload {
  sub: 'registration';
  phone: string;
  purpose: 'complete-registration';
}

const OTP_EXPIRES_IN_MS = 5 * 60 * 1000;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_OTP_SENDS_PER_WINDOW = 3;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashOtp(phone: string, code: string): string {
    const secret = this.configService.getOrThrow<string>(
      'security.otpHashSecret',
    );

    return createHmac('sha256', secret)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  private matchesOtp(expectedHash: string, actualHash: string): boolean {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private generateAccessToken(userId: string, phone: string): string {
    return this.jwtService.sign({ sub: userId, phone, purpose: 'access' });
  }

  private generateRegistrationToken(phone: string): string {
    return this.jwtService.sign(
      { sub: 'registration', phone, purpose: 'complete-registration' },
      { expiresIn: '5m' },
    );
  }

  private publicUser<
    T extends {
      id: string;
      phone: string;
      fullName: string | null;
      status: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
  >(user: T) {
    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

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
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MS);
    const [, otpRecord] = await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { phone, isUsed: false, expiresAt: { gte: new Date() } },
        data: { isUsed: true },
      }),
      this.prisma.otpCode.create({
        data: {
          phone,
          codeHash: this.hashOtp(phone, code),
          expiresAt,
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

    const submittedHash = this.hashOtp(phone, dto.code);

    if (!this.matchesOtp(otpRecord.codeHash, submittedHash)) {
      const updatedOtp = await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: {
          attemptCount: { increment: 1 },
        },
      });

      if (updatedOtp.attemptCount >= MAX_OTP_ATTEMPTS) {
        await this.prisma.otpCode.updateMany({
          where: { id: otpRecord.id, isUsed: false },
          data: { isUsed: true },
        });
        throw new HttpException(
          'Bạn đã nhập sai OTP quá nhiều lần. Vui lòng yêu cầu mã mới.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
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

      this.logger.log(`Đăng nhập thành công cho SĐT: ${phone}`);
      return {
        success: true,
        isNewUser: false,
        message: 'Đăng nhập thành công.',
        data: {
          accessToken: this.generateAccessToken(existingUser.id, phone),
          user: this.publicUser(existingUser),
        },
      };
    }

    this.logger.log(`Xác thực OTP đăng ký thành công cho SĐT: ${phone}`);
    return {
      success: true,
      isNewUser: true,
      message: 'Xác thực OTP thành công. Vui lòng hoàn tất đăng ký.',
      data: {
        phone,
        registrationToken: this.generateRegistrationToken(phone),
      },
    };
  }

  async completeRegistration(dto: CompleteRegistrationDto) {
    let payload: RegistrationTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RegistrationTokenPayload>(
        dto.registrationToken,
      );

      if (
        payload.sub !== 'registration' ||
        payload.purpose !== 'complete-registration' ||
        !payload.phone
      ) {
        throw new Error('Invalid registration token payload');
      }
    } catch {
      throw new BadRequestException(
        'Registration token không hợp lệ hoặc đã hết hạn.',
      );
    }

    try {
      const newUser = await this.prisma.user.create({
        data: { phone: payload.phone, fullName: dto.fullName },
      });

      this.logger.log(`Tạo tài khoản mới thành công cho SĐT: ${payload.phone}`);
      return {
        success: true,
        message: 'Đăng ký tài khoản thành công.',
        data: {
          accessToken: this.generateAccessToken(newUser.id, newUser.phone),
          user: this.publicUser(newUser),
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

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản hiện không hoạt động.');
    }

    return { success: true, data: { user: this.publicUser(user) } };
  }
}
