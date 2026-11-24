import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { MemberAvailabilityService } from '../application/availability/member-availability.service';
import {
  MemberHeartbeatDto,
  MemberOfflineDto,
  MemberOnlineDto,
  MemberReceivingSettingsDto,
} from '../dto/member-capabilities.dto';

const sessionExample = {
  online: true,
  session: {
    id: '41a85643-b755-442e-b2c1-060889ab381c',
    startedAt: '2026-10-28T08:00:00.000Z',
    lastHeartbeatAt: '2026-10-28T08:01:00.000Z',
  },
  heartbeatTtlSeconds: 120,
};
const settingsExample = {
  memberId: '216a1b81-4061-42be-b08a-3497522fb430',
  receivingRadiusKm: 5,
  organizationRadiusKm: 15,
  effectiveRadiusKm: 5,
};

@ApiTags('Provider Member Availability')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiConflictError(
  'Phiên cũ/hết hạn, ví tổ chức, lịch hoặc năng lực chưa đủ điều kiện.',
)
@Controller('me/provider/memberships/:id')
export class MemberAvailabilityController {
  constructor(private readonly availability: MemberAvailabilityService) {}

  @Get('receiving-settings')
  @ApiOperation({
    summary: 'Xem bán kính nhận đơn của chính mình',
    description:
      'Chưa cấu hình riêng thì dùng bán kính tổ chức. Effective luôn là giá trị nhỏ hơn.',
  })
  @ApiStandardOk({
    description: 'Không có quyền xem ví tổ chức.',
    data: settingsExample,
  })
  settings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availability.settings(user.userId, id);
  }

  @Put('receiving-settings')
  @ApiOperation({
    summary: 'Thành viên cấu hình bán kính nhận đơn của mình',
    description:
      '1–50 km, không vượt tổ chức. Thay cấu hình tắt phiên online để tránh dùng vị trí/cấu hình cũ.',
  })
  @ApiStandardOk({ description: 'Bán kính đã lưu.', data: settingsExample })
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberReceivingSettingsDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.availability.configure(user.userId, id, dto, metadata);
  }

  @Get('availability')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Trạng thái online và lý do chưa đủ điều kiện nhận đơn',
    description:
      'Chỉ bản thân được đọc. Redis lỗi trả online=false, locationAvailable=false; eligible chỉ là điều kiện nền, chưa là kết quả kiểm tra một đơn cụ thể.',
  })
  @ApiStandardOk({
    description: 'Session chỉ trả khi cả DB và GPS Redis còn hiệu lực.',
    data: {
      ...sessionExample,
      recommendedHeartbeatSeconds: 30,
      effectiveRadiusKm: 5,
      receivingEligibility: { eligible: true, blockerCode: null },
      locationAvailable: true,
    },
  })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availability.status(user.userId, id);
  }

  @Post('availability/online')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tự bật online bằng GPS mới của thành viên',
    description:
      'Kiểm tra KYC, dịch vụ/chứng chỉ, lịch/nghỉ phép, tổ chức active, setup và ví khả dụng tối thiểu 50.000đ. Không cho owner phát GPS thay worker. Chưa nối vào Discovery nhiều worker (P5C).',
  })
  @ApiServiceUnavailableResponse({
    description: 'Redis không khả dụng; không trả online thành công.',
  })
  @ApiStandardOk({
    description:
      'Lưu session.id để heartbeat và offline. Phiên mới thay phiên cũ.',
    data: sessionExample,
  })
  online(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberOnlineDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.availability.online(user.userId, id, dto, metadata);
  }

  @Post('availability/heartbeat')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cập nhật GPS/heartbeat cho đúng phiên đang hoạt động',
    description:
      'GPS phải mới hơn lần trước. TTL mặc định 120 giây, heartbeat khoảng 30 giây. Không heartbeat hồi sinh phiên hết hạn; app cần gọi online lại sau đồng ý của thợ.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Không thể lưu vị trí, đóng phiên lỗi an toàn.',
  })
  @ApiStandardOk({
    description: 'Không trả lại tọa độ vào response hoặc audit.',
    data: sessionExample,
  })
  heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberHeartbeatDto,
  ) {
    return this.availability.heartbeat(user.userId, id, dto);
  }

  @Post('availability/offline')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tắt đúng phiên nhận đơn của mình',
    description:
      'DB đóng phiên dù Redis lỗi. Request phiên cũ không được tắt phiên mới. Không tự hủy đơn đã nhận.',
  })
  @ApiStandardOk({
    description: 'Đã ngừng nhận đơn mới.',
    data: { online: false },
  })
  offline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberOfflineDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.availability.offline(user.userId, id, dto.sessionId, metadata);
  }
}
