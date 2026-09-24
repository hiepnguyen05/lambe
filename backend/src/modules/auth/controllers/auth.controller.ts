import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint 1: Gửi mã OTP xác thực qua SMS (SpeedSMS)
   * POST /api/auth/send-otp
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  /**
   * Endpoint 2: Xác thực mã OTP 6 số
   * - Nếu ĐÃ CÓ tài khoản -> Tự động Đăng nhập & Trả về JWT AccessToken (isNewUser: false)
   * - Nếu CHƯA CÓ tài khoản -> Trả về isNewUser: true để chuyển sang bước Đăng ký
   * POST /api/auth/verify-otp
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * Endpoint 3: Hoàn tất Đăng ký Thông tin cho Customer mới & Trả về JWT AccessToken
   * POST /api/auth/complete-registration
   */
  @Post('complete-registration')
  @HttpCode(HttpStatus.CREATED)
  async completeRegistration(@Body() dto: CompleteRegistrationDto) {
    return this.authService.completeRegistration(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}
