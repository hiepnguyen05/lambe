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
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getCurrent(user.userId);
  }

  @Put()
  @ApiOperation({ summary: 'Lưu một phần hoặc toàn bộ khảo sát onboarding' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerOnboardingDto,
  ) {
    return this.onboarding.update(user.userId, dto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hoàn tất onboarding khách hàng' })
  complete(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.complete(user.userId);
  }

  @Post('skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ qua onboarding và có thể hoàn thiện sau' })
  skip(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.skip(user.userId);
  }
}
