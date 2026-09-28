import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderSetupService } from '../application/provider-setup.service';
import { ProviderSetupDto } from '../dto/provider-setup.dto';

@ApiTags('Provider Setup')
@ApiBearerAuth('user-token')
@Controller('me/provider/setup')
@UseGuards(JwtAuthGuard)
export class ProviderSetupController {
  constructor(private readonly setup: ProviderSetupService) {}

  @Get()
  @ApiOperation({
    summary: 'Xem cấu hình phục vụ của nhà cung cấp đã được duyệt',
  })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.setup.findMine(user.userId);
  }

  @Put()
  @ApiOperation({
    summary:
      'Thiết lập khu vực, bán kính, lịch và dịch vụ phục vụ; không bật nhận đơn',
  })
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProviderSetupDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.setup.configure(user.userId, dto, request);
  }
}
