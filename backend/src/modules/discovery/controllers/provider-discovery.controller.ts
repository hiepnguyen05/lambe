import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  providerSearchExample,
  publicProviderExample,
} from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiDependencyUnavailableError,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderDiscoveryService } from '../application/provider-discovery.service';
import {
  ProviderSearchDto,
  PublicProviderParamDto,
} from '../dto/provider-search.dto';

@ApiTags('Provider Discovery')
@Controller()
export class ProviderDiscoveryController {
  constructor(private readonly discovery: ProviderDiscoveryService) {}

  @Post('discovery/providers/search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-token')
  @ApiOperation({
    summary: 'Tìm nhà cung cấp đang online gần vị trí khách hàng',
    description:
      'Dùng POST body để tránh ghi vị trí chính xác của khách vào query/access log. Response không trả tọa độ thật của nhà cung cấp.',
  })
  @ApiStandardOk({
    description: 'Danh sách nhà cung cấp phù hợp với dịch vụ và vị trí khách.',
    data: providerSearchExample.data,
    meta: providerSearchExample.meta,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiDependencyUnavailableError(
    'Redis tìm vị trí nhà cung cấp không khả dụng.',
  )
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProviderSearchDto,
  ) {
    return this.discovery.search(user.userId, dto);
  }

  @Get('providers/:id/public')
  @ApiOperation({ summary: 'Xem hồ sơ công khai của nhà cung cấp' })
  @ApiStandardOk({
    description: 'Hồ sơ công khai của nhà cung cấp đang hoạt động.',
    data: publicProviderExample,
  })
  @ApiNotFoundError('Nhà cung cấp')
  findPublicProfile(@Param() params: PublicProviderParamDto) {
    return this.discovery.findPublicProfile(params.id);
  }
}
