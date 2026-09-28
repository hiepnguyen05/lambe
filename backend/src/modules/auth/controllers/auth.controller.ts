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
import { FirebaseAuthenticationService } from '../application/firebase-authentication.service';
import { UserProfileService } from '../application/user-profile.service';
import { UserRegistrationService } from '../application/user-registration.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CheckFirebasePhoneLinkDto } from '../dto/check-firebase-phone-link.dto';
import { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { ExchangeFirebaseTokenDto } from '../dto/exchange-firebase-token.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@ApiTags('User Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly firebaseAuthentication: FirebaseAuthenticationService,
    private readonly registration: UserRegistrationService,
    private readonly userProfile: UserProfileService,
  ) {}

  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Exchange a Firebase identity token for Lambe auth',
  })
  async exchangeFirebaseToken(@Body() dto: ExchangeFirebaseTokenDto) {
    return this.firebaseAuthentication.exchangeIdToken(dto);
  }

  @Post('firebase/phone-link-check')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary:
      'Check whether a phone number can be linked to a Firebase social identity',
  })
  async checkFirebasePhoneLink(@Body() dto: CheckFirebasePhoneLinkDto) {
    return this.firebaseAuthentication.checkPhoneLink(dto);
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
