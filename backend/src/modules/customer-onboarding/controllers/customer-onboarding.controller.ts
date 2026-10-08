import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { onboardingProfileExample } from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CustomerOnboardingService } from '../application/customer-onboarding.service';
import { UpdateCustomerOnboardingDto } from '../dto/update-customer-onboarding.dto';

@ApiTags('Customer Onboarding')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/onboarding')
export class CustomerOnboardingController {
  constructor(private readonly onboarding: CustomerOnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy trạng thái và sở thích onboarding hiện tại' })
  @ApiStandardOk({
    description: 'Trạng thái onboarding và sở thích đã lưu của khách hàng.',
    data: onboardingProfileExample,
  })
  @ApiAuthenticationErrors()
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getCurrent(user.userId);
  }

  @Put()
  @ApiOperation({ summary: 'Lưu một phần hoặc toàn bộ khảo sát onboarding' })
  @ApiStandardOk({
    description:
      'Lưu lựa chọn khảo sát; có thể gọi nhiều lần trước khi hoàn tất.',
    data: onboardingProfileExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerOnboardingDto,
  ) {
    return this.onboarding.update(user.userId, dto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hoàn tất onboarding khách hàng' })
  @ApiStandardOk({
    description: 'Đánh dấu onboarding đã hoàn tất.',
    data: onboardingProfileExample,
  })
  @ApiAuthenticationErrors()
  complete(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.complete(user.userId);
  }

  @Post('skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ qua onboarding và có thể hoàn thiện sau' })
  @ApiStandardOk({
    description:
      'Bỏ qua onboarding; frontend vẫn có thể cho người dùng quay lại.',
    data: onboardingProfileExample,
  })
  @ApiAuthenticationErrors()
  skip(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.skip(user.userId);
  }
}
