import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  availabilityHeartbeatExample,
  availabilityStatusExample,
} from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiDependencyUnavailableError,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderAvailabilityService } from '../application/availability/provider-availability.service';
import { ProviderLocationDto } from '../dto/provider-location.dto';

@ApiTags('Provider Availability')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/provider/availability')
export class ProviderAvailabilityController {
  constructor(private readonly availability: ProviderAvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Xem trạng thái online hiện tại của nhà cung cấp' })
  @ApiStandardOk({
    description: 'Trạng thái nhận đơn và phiên online hiện tại.',
    data: availabilityStatusExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hồ sơ nhà cung cấp')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.availability.getStatus(user.userId);
  }

  @Post('online')
  @ApiOperation({ summary: 'Bật nhận đơn và ghi nhận vị trí hiện tại' })
  @ApiStandardOk({
    description:
      'Bật online thành công. Vị trí hiện tại được lưu tạm trong Redis GEO.',
    message: 'Đã bật trạng thái sẵn sàng nhận đơn.',
    data: availabilityStatusExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ nhà cung cấp')
  @ApiDependencyUnavailableError(
    'Redis lưu vị trí nhà cung cấp không khả dụng.',
  )
  goOnline(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProviderLocationDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.availability.goOnline(user.userId, dto, request);
  }

  @Put('heartbeat')
  @ApiOperation({ summary: 'Gia hạn trạng thái online và cập nhật vị trí' })
  @ApiStandardOk({
    description:
      'Gia hạn trạng thái online và cập nhật vị trí hiện tại của nhà cung cấp.',
    data: availabilityHeartbeatExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ nhà cung cấp')
  @ApiDependencyUnavailableError(
    'Redis lưu vị trí nhà cung cấp không khả dụng.',
  )
  heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProviderLocationDto,
  ) {
    return this.availability.heartbeat(user.userId, dto);
  }

  @Post('offline')
  @ApiOperation({ summary: 'Tắt nhận đơn và kết thúc phiên online' })
  @ApiStandardOk({
    description: 'Tắt online và đóng các phiên nhận đơn còn mở.',
    message: 'Đã tắt trạng thái nhận đơn.',
    data: { online: false, closedSessionCount: 1 },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hồ sơ nhà cung cấp')
  goOffline(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.availability.goOffline(user.userId, request);
  }
}
