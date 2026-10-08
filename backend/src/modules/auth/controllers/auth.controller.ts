import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import 'multer';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  createImageUploadPipe,
  MAX_IMAGE_SIZE_BYTES,
} from '../../../common/http/files/image-upload.validation';
import {
  phoneLinkCheckExample,
  userAuthExample,
  userExample,
} from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiRateLimitError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { FirebaseAuthenticationService } from '../application/firebase-authentication.service';
import { UserProfileService } from '../application/user-profile.service';
import { UserRegistrationService } from '../application/user-registration.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CheckFirebasePhoneLinkDto } from '../dto/check-firebase-phone-link.dto';
import { CompleteRegistrationDto } from '../dto/complete-registration.dto';
import { ExchangeFirebaseTokenDto } from '../dto/exchange-firebase-token.dto';
import { UpdateCurrentUserProfileDto } from '../dto/update-current-user-profile.dto';
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
  @Header('Cache-Control', 'no-store')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary: 'Exchange a Firebase identity token for Lambe auth',
    description:
      'Frontend gửi Firebase ID token sau khi đăng nhập bằng số điện thoại, Google hoặc Facebook. Backend xác minh với Firebase và trả JWT của Lambe.',
  })
  @ApiStandardOk({
    description: 'Đăng nhập thành công hoặc tạo phiên Lambe cho tài khoản mới.',
    data: userAuthExample,
  })
  @ApiValidationError()
  @ApiRateLimitError()
  async exchangeFirebaseToken(@Body() dto: ExchangeFirebaseTokenDto) {
    return this.firebaseAuthentication.exchangeIdToken(dto);
  }

  @Post('firebase/phone-link-check')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({
    summary:
      'Check whether a phone number can be linked to a Firebase social identity',
    description:
      'Dùng trước khi gửi OTP liên kết số điện thoại cho tài khoản đăng nhập Google/Facebook để tránh gửi OTP tới số đã thuộc tài khoản khác.',
  })
  @ApiStandardOk({
    description: 'Trả về trạng thái có thể liên kết số điện thoại hay không.',
    data: phoneLinkCheckExample,
  })
  @ApiValidationError()
  @ApiConflictError('Số điện thoại đã thuộc một tài khoản Lambe khác.')
  @ApiRateLimitError()
  async checkFirebasePhoneLink(@Body() dto: CheckFirebasePhoneLinkDto) {
    return this.firebaseAuthentication.checkPhoneLink(dto);
  }

  @Post('complete-registration')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Complete a new user registration' })
  @ApiStandardCreated({
    description: 'Hoàn tất hồ sơ người dùng và trả về access token.',
    data: userAuthExample,
  })
  @ApiValidationError()
  @ApiConflictError('Số điện thoại đã tồn tại.')
  async completeRegistration(@Body() dto: CompleteRegistrationDto) {
    return this.registration.completeRegistration(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth('user-token')
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiStandardOk({
    description: 'Thông tin hồ sơ khách hàng hiện tại.',
    data: userExample,
  })
  @ApiAuthenticationErrors()
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.userProfile.getCurrentUser(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-token')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiStandardOk({
    description: 'Cập nhật hồ sơ khách hàng thành công.',
    data: userExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  async updateCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCurrentUserProfileDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.userProfile.updateCurrentUser(user.userId, dto, request);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiBearerAuth('user-token')
  @ApiOperation({ summary: 'Upload the current user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, WEBP hoặc GIF; tối đa 5 MB',
        },
      },
    },
  })
  @ApiStandardOk({
    description: 'Tải ảnh đại diện thành công và trả về hồ sơ mới.',
    data: userExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiRateLimitError()
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.userProfile.uploadAvatar(user.userId, file.buffer, request);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-token')
  @ApiOperation({ summary: 'Remove the current user avatar' })
  @ApiStandardOk({
    description: 'Xóa ảnh đại diện thành công và trả về hồ sơ mới.',
    data: userExample,
  })
  @ApiAuthenticationErrors()
  async removeAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.userProfile.removeAvatar(user.userId, request);
  }
}
