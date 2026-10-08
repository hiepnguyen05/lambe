import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { onboardingOptionsExample } from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiStandardOk,
} from '../../../common/openapi/api-response.decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CustomerOnboardingService } from '../application/customer-onboarding.service';

@ApiTags('Customer Onboarding')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingOptionsController {
  constructor(private readonly onboarding: CustomerOnboardingService) {}

  @Get('options')
  @ApiOperation({ summary: 'Lấy danh mục và dịch vụ dùng cho khảo sát' })
  @ApiStandardOk({
    description:
      'Danh mục và dịch vụ đang hoạt động để frontend dựng câu hỏi onboarding.',
    data: onboardingOptionsExample,
  })
  @ApiAuthenticationErrors()
  getOptions() {
    return this.onboarding.getOptions();
  }
}
