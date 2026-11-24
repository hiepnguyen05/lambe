import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { MemberServicesService } from '../application/capabilities/member-services.service';
import { MemberScheduleService } from '../application/capabilities/member-schedule.service';
import { MemberOrganizationReceivingService } from '../application/availability/member-organization-receiving.service';
import {
  AssignMemberServicesDto,
  MemberChangeReasonDto,
  MemberTimeOffDto,
  MemberTimeOffQueryDto,
  MemberWorkingHoursDto,
  OrganizationMemberReceivingDto,
} from '../dto/member-capabilities.dto';

const offeringExample = {
  providerServiceId: 'b476f4b1-1781-4006-a8ca-b5fd06877736',
  serviceId: '6b601aac-663b-4ee2-a23c-c087f7d373d0',
  name: 'Cắt tóc nam',
  priceAmount: 150000,
  durationMinutes: 60,
  status: 'ACTIVE',
  categoryId: '3bea9752-fce9-422b-97c3-b855d09bc83f',
  enabled: true,
  eligible: true,
  blockerCode: null,
};
const hoursExample = [{ dayOfWeek: 1, startMinute: 480, endMinute: 1200 }];
const timeOffExample = {
  id: '41a85643-b755-442e-b2c1-060889ab381c',
  startAt: '2026-11-01T08:00:00+07:00',
  endAt: '2026-11-01T12:00:00+07:00',
  reason: 'Nghỉ việc riêng',
};

@ApiTags('Provider Member Capabilities')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiConflictError(
  'KYC/chứng chỉ, lịch hoặc nghĩa vụ hiện tại không cho phép thay đổi.',
)
@Controller('me/provider')
export class MemberCapabilitiesController {
  constructor(
    private readonly services: MemberServicesService,
    private readonly schedule: MemberScheduleService,
    private readonly organization: MemberOrganizationReceivingService,
  ) {}

  @Get('member-receiving')
  @ApiOperation({
    summary: 'Owner xem trạng thái nhận đơn chung qua thành viên tổ chức',
  })
  @ApiStandardOk({
    description: 'Không phải trạng thái online của owner hoặc một worker.',
    data: {
      providerId: '216a1b81-4061-42be-b08a-3497522fb430',
      enabled: true,
      providerStatus: 'ACTIVE',
    },
  })
  organizationStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.organization.status(user.userId);
  }

  @Put('member-receiving')
  @ApiOperation({
    summary: 'Owner bật/tạm dừng nhận đơn qua tất cả thành viên',
    description:
      'Tạm dừng đóng mọi phiên member; không hủy đơn. Bật lại không tự khởi động GPS/online; từng người tự bật bằng vị trí mới. Luồng provider cũ vẫn capacity=1 trước P5C.',
  })
  @ApiStandardOk({
    description: 'Có lý do và audit.',
    data: {
      providerId: '216a1b81-4061-42be-b08a-3497522fb430',
      enabled: false,
      providerStatus: 'ACTIVE',
    },
  })
  organizationConfigure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OrganizationMemberReceivingDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.organization.configure(user.userId, dto, metadata);
  }

  @Get('members/:id/service-options')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Owner xem dịch vụ thành viên đã đề nghị xác minh và điều kiện cấp quyền',
    description:
      'Chỉ metadata dịch vụ và blockerCode; không trả giấy tờ/KYC. Không phải danh sách toàn bộ dịch vụ hệ thống.',
  })
  @ApiStandardOk({
    description: 'Tối đa 50 lựa chọn, không tự cấp quyền.',
    data: [offeringExample],
  })
  options(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.services.options(user.userId, id);
  }

  @Get(['memberships/:id/services', 'members/:id/services'])
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Thành viên xem dịch vụ của mình; owner xem dịch vụ của thành viên tổ chức',
    description:
      'Giá thuộc tổ chức. Chứng chỉ hết hạn/tắt danh mục làm eligible=false, không xóa lịch sử.',
  })
  @ApiStandardOk({
    description:
      'Dịch vụ đang cấp trước, tối đa 100 dòng gồm lịch sử thu hồi hiện hành.',
    data: [offeringExample],
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.services.list(user.userId, id);
  }

  @Put('members/:id/services')
  @ApiOperation({
    summary: 'Owner thay toàn bộ dịch vụ được cấp cho thành viên',
    description:
      'Worker không được tự cấp dịch vụ hoặc sửa giá. [] thu hồi hết; kiểm tra KYC/chứng chỉ từng dịch vụ. Thay đổi kết thúc phiên online, phải bật lại.',
  })
  @ApiStandardOk({
    description: 'Danh sách sau cập nhật nguyên tử.',
    data: [offeringExample],
  })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMemberServicesDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.services.assign(user.userId, id, dto, metadata);
  }

  @Get(['memberships/:id/working-hours', 'members/:id/working-hours'])
  @ApiOperation({
    summary: 'Xem lịch tuần của mình hoặc thành viên thuộc tổ chức của owner',
  })
  @ApiStandardOk({
    description:
      '0=Chủ nhật, 1=Thứ hai; phút từ đầu ngày, ca qua đêm tách đôi.',
    data: hoursExample,
    meta: { timeZone: 'Asia/Ho_Chi_Minh' },
  })
  hours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedule.hours(user.userId, id);
  }

  @Put(['memberships/:id/working-hours', 'members/:id/working-hours'])
  @ApiOperation({
    summary: 'Thay lịch tuần của member',
    description:
      'Owner sửa người khác phải có reason. Không chồng ca; [] xóa lịch tuần hiện hành. Tạm chặn khi tổ chức còn nghĩa vụ đơn/lịch (trước P5C). Kết thúc phiên online.',
  })
  @ApiStandardOk({
    description: 'Lịch đã thay thế.',
    data: hoursExample,
    meta: { timeZone: 'Asia/Ho_Chi_Minh' },
  })
  replaceHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberWorkingHoursDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.schedule.replaceHours(user.userId, id, dto, metadata);
  }

  @Get(['memberships/:id/time-offs', 'members/:id/time-offs'])
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Xem lịch nghỉ giao với cửa sổ from/to, có phân trang',
  })
  @ApiStandardOk({
    description: 'Chỉ lịch nghỉ chưa hủy của lần gia nhập hiện tại.',
    data: [timeOffExample],
  })
  timeOffs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MemberTimeOffQueryDto,
  ) {
    return this.schedule.timeOffs(user.userId, id, query);
  }

  @Post(['memberships/:id/time-offs', 'members/:id/time-offs'])
  @ApiOperation({
    summary: 'Thêm lịch nghỉ cá nhân',
    description:
      'Owner sửa người khác phải có reason. Tối đa 90 ngày/lần, bắt đầu trong 366 ngày tới; không chồng lịch nghỉ. Kết thúc phiên online; không hủy đơn.',
  })
  @ApiStandardCreated({
    description: 'Khoảng nghỉ đã lưu, tự chặn online khi đến thời gian nghỉ.',
    data: timeOffExample,
  })
  addTimeOff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MemberTimeOffDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.schedule.addTimeOff(user.userId, id, dto, metadata);
  }

  @Delete([
    'memberships/:id/time-offs/:timeOffId',
    'members/:id/time-offs/:timeOffId',
  ])
  @ApiOperation({
    summary: 'Hủy lịch nghỉ, giữ lịch sử và audit',
    description:
      'Gửi JSON reason khi owner thao tác cho người khác. Không tự bật online lại.',
  })
  @ApiStandardOk({
    description: 'Hủy lặp lại an toàn.',
    data: { id: timeOffExample.id, cancelled: true },
  })
  cancelTimeOff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('timeOffId', ParseUUIDPipe) timeOffId: string,
    @Body() dto: MemberChangeReasonDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.schedule.cancelTimeOff(
      user.userId,
      id,
      timeOffId,
      dto,
      metadata,
    );
  }
}
