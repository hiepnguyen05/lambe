import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OtpAuthenticationService } from '../application/otp-authentication.service';
import { UserProfileService } from '../application/user-profile.service';
import { UserRegistrationService } from '../application/user-registration.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@ApiTags('User Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otpAuthentication: OtpAuthenticationService,
    private readonly registration: UserRegistrationService,
    private readonly userProfile: UserProfileService,
  ) {}

  /**
   * Endpoint 1: Gửi mã OTP xác thực qua SMS (SpeedSMS)
   * POST /api/auth/send-otp
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 5, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Send a phone verification OTP' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.otpAuthentication.sendOtp(dto);
  }

  /**
   * Endpoint 2: Xác thực mã OTP 6 số
   * - Nếu ĐÃ CÓ tài khoản -> Tự động Đăng nhập & Trả về JWT AccessToken (isNewUser: false)
   * - Nếu CHƯA CÓ tài khoản -> Trả về isNewUser: true để chuyển sang bước Đăng ký
   * POST /api/auth/verify-otp
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Verify an OTP and continue sign-in' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otpAuthentication.verifyOtp(dto);
  }

  /**
   * Endpoint 3: Hoàn tất Đăng ký Thông tin cho Customer mới & Trả về JWT AccessToken
   * POST /api/auth/complete-registration
   */
  @Post('complete-registration')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete a new user registration' })
  async completeRegistration(@Body() dto: CompleteRegistrationDto) {
    return this.registration.completeRegistration(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-token')
  @ApiOperation({ summary: 'Get the current user profile' })
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.userProfile.getCurrentUser(user.userId);
  }
}
