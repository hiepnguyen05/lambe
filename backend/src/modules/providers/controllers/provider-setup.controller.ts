import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import { providerSetupExample } from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
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
  @ApiStandardOk({
    description: 'Cấu hình phục vụ hiện tại của nhà cung cấp.',
    data: providerSetupExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hồ sơ nhà cung cấp')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.setup.findMine(user.userId);
  }

  @Put()
  @ApiOperation({
    summary:
      'Thiết lập khu vực, bán kính, lịch và dịch vụ phục vụ; không bật nhận đơn',
  })
  @ApiStandardOk({
    description:
      'Lưu cấu hình phục vụ thành công. Nhà cung cấp vẫn cần bật online để nhận đơn.',
    data: providerSetupExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ nhà cung cấp')
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProviderSetupDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.setup.configure(user.userId, dto, request);
  }
}
