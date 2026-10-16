import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('user-token')
  @ApiOperation({
    summary: 'Tìm thợ cho đặt ngay hoặc đặt trước, kiểm tra bán kính và lịch',
    description:
      'ASAP dùng GPS online; SCHEDULED dùng tâm khu vực phục vụ. Dùng POST body để tránh ghi tọa độ khách vào query/access log. available và suggestedSlots chỉ là gợi ý, không giữ lịch. Không trả tọa độ thật của thợ.',
  })
  @ApiStandardOk({
    description: 'Danh sách nhà cung cấp phù hợp với dịch vụ và vị trí khách.',
    data: providerSearchExample.data.map((item) => ({
      ...item,
      available: true,
      reason: null,
      expectedStartAt: '2026-10-14T07:00:00.000Z',
      expectedEndAt: '2026-10-14T08:00:00.000Z',
      suggestedSlots: [],
      requiresProviderConfirmation: true,
      estimateSource: 'CONSERVATIVE_DISTANCE',
    })),
    meta: {
      ...providerSearchExample.meta,
      bookingType: 'SCHEDULED',
      candidateLimit: 300,
      searchLimited: false,
    },
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
