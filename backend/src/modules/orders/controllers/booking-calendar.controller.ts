import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiAuthenticationErrors,
  ApiStandardOk,
  ApiStandardCreated,
  ApiValidationError,
  ApiNotFoundError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { BookingAvailabilityService } from '../application/scheduling/booking-availability.service';
import {
  BookingAvailabilityQueryDto,
  CalendarRangeDto,
  CreateTimeOffDto,
} from '../dto/booking-calendar.dto';
import { OrderParamDto } from '../dto/order.dto';

@ApiTags('Booking Calendar')
@ApiBearerAuth('user-token')
@ApiAuthenticationErrors()
@UseGuards(JwtAuthGuard)
@Controller()
export class BookingCalendarController {
  constructor(private readonly availability: BookingAvailabilityService) {}

  @Get('me/provider/memberships/:id/calendar')
  @ApiOperation({
    summary:
      'Member xem lịch bận/nghỉ của mình; owner xem đúng thành viên tổ chức',
    description:
      'Tối đa 31 ngày, 500 khoảng. Gồm đơn đang giữ/đã nhận, lịch đổi đang chờ, nghỉ phép và legacy commitment ẩn danh; không trả đơn/địa chỉ của người khác. Không giữ lịch khi đọc.',
  })
  @ApiStandardOk({
    description:
      'Lịch bận tổng hợp; dùng danh sách đơn của mình để mở chi tiết công việc.',
    data: [
      {
        startAt: '2026-11-01T07:00:00.000Z',
        endAt: '2026-11-01T08:00:00.000Z',
        kind: 'BUSY',
        estimated: false,
      },
    ],
    meta: {
      memberId: '216a1b81-4061-42be-b08a-3497522fb430',
      timezone: 'Asia/Ho_Chi_Minh',
      limit: 500,
      limited: false,
    },
  })
  memberCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Query() dto: CalendarRangeDto,
  ) {
    return this.availability.findMemberCalendar(user.userId, params.id, dto);
  }

  @Get('providers/:id/availability')
  @ApiOperation({
    summary: 'Gợi ý khung giờ trống cho dịch vụ và địa chỉ đã chọn',
    description:
      'Gửi memberId khi chọn chuyên viên tổ chức; chỉ xét lịch, nghỉ, năng lực và khoảng đệm di chuyển của người đó, cộng lịch legacy chung. Bán kính hiệu lực lấy min(member,organization). Query hiện yêu cầu customerAddressId; địa chỉ nhập ngay dùng discovery/quote. Slot chỉ là gợi ý, không giữ lịch; người được chọn vẫn phải nhận đơn.',
  })
  @ApiStandardOk({
    description: 'Available 15-minute start times in Vietnam time.',
    data: {
      date: '2026-10-13',
      timezone: 'Asia/Ho_Chi_Minh',
      durationMinutes: 60,
      providerServiceId: 'provider-service-uuid',
      memberId: '216a1b81-4061-42be-b08a-3497522fb430',
      reason: null,
      requiresProviderConfirmation: true,
      estimateSource: 'CONSERVATIVE_DISTANCE',
      slots: [
        {
          startAt: '2026-10-13T07:00:00.000Z',
          endAt: '2026-10-13T08:00:00.000Z',
          availability: 'AVAILABLE',
          requiresProviderConfirmation: true,
        },
      ],
    },
  })
  @ApiValidationError()
  @ApiNotFoundError('Địa chỉ hoặc dịch vụ của thợ')
  findSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Query() dto: BookingAvailabilityQueryDto,
  ) {
    return this.availability.findSlots(user.userId, params.id, dto);
  }

  @Get('me/provider/calendar')
  @ApiOperation({
    summary: 'Xem lịch giữ chỗ, đơn đã nhận và thời gian nghỉ của thợ',
  })
  @ApiStandardOk({
    description: 'Own calendar only. Maximum range: 31 days.',
    data: [
      {
        id: 'block-uuid',
        orderId: 'order-uuid',
        startAt: '2026-10-14T07:00:00.000Z',
        endAt: '2026-10-14T08:00:00.000Z',
        holdExpiresAt: null,
        reason: null,
        order: {
          status: 'ACCEPTED',
          bookingType: 'SCHEDULED',
          expectedStartAt: '2026-10-14T07:00:00.000Z',
          expectedEndAt: '2026-10-14T08:00:00.000Z',
          serviceName: 'Cắt tóc nam',
        },
      },
    ],
    meta: { timezone: 'Asia/Ho_Chi_Minh', limit: 500 },
  })
  findCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: CalendarRangeDto,
  ) {
    return this.availability.findCalendar(user.userId, dto);
  }

  @Post('me/provider/calendar/time-off')
  @ApiOperation({
    summary: 'Khóa lịch nghỉ, không được chồng lên đơn đã giữ/nhận',
  })
  @ApiStandardCreated({
    description:
      'Time off created. At least 15 minutes, within the next 31 days, maximum 200 upcoming time-off blocks.',
    data: {
      id: 'block-uuid',
      startAt: '2026-10-14T07:00:00.000Z',
      endAt: '2026-10-14T08:00:00.000Z',
      reason: 'Nghi phep',
    },
  })
  @ApiValidationError()
  createTimeOff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimeOffDto,
  ) {
    return this.availability.createTimeOff(user.userId, dto);
  }

  @Delete('me/provider/calendar/time-off/:id')
  @ApiOperation({ summary: 'Mở lại lịch nghỉ của chính mình' })
  @ApiStandardOk({
    description: 'Time off released.',
    data: { id: 'block-uuid', active: false },
  })
  removeTimeOff(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
  ) {
    return this.availability.removeTimeOff(user.userId, params.id);
  }
}
