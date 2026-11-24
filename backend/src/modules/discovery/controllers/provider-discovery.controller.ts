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
      'ASAP dùng GPS/heartbeat còn hạn của người thực hiện; SCHEDULED dùng tâm khu vực tổ chức và lịch riêng của member. Tổ chức có thể trả nhiều thẻ cùng providerId nhưng khác memberId; khóa thẻ bằng cặp providerId/memberId. Thẻ member có reviewSummary (count, averageRating nullable) là điểm riêng của người thực hiện, không dùng điểm tổ chức thay thế. Có thể lọc providerId/memberId khi chọn thợ trước. Gửi memberId cùng service.id (providerServiceId) khi báo giá và tạo đơn tổ chức. distanceKm là đường chim bay; estimatedTravelDistanceKm/estimatedTravelFeeAmount chỉ ước tính, /orders/quote là giá chính thức. available=false có thể kèm suggestedSlots, không giữ lịch. Không trả tọa độ thật hoặc KYC của thợ.',
  })
  @ApiStandardOk({
    description: 'Danh sách nhà cung cấp phù hợp với dịch vụ và vị trí khách.',
    data: providerSearchExample.data.map((item) => ({
      ...item,
      providerId: item.id,
      memberId: null,
      member: null,
      organization: null,
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
      candidateLimit: 600,
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
  @ApiOperation({
    summary: 'Xem hồ sơ công khai của nhà cung cấp',
    description:
      'stats.rating là điểm thực tế của đối tác, null khi chưa có đánh giá (stats.reviewCount=0); không mặc định 5 sao. reviews[].assignedMember là snapshot của người thực hiện, null với đơn cũ/cá nhân chưa gắn member.',
  })
  @ApiStandardOk({
    description: 'Hồ sơ công khai của nhà cung cấp đang hoạt động.',
    data: publicProviderExample,
  })
  @ApiNotFoundError('Nhà cung cấp')
  findPublicProfile(@Param() params: PublicProviderParamDto) {
    return this.discovery.findPublicProfile(params.id);
  }
}
