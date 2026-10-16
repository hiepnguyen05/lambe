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

  @Get('providers/:id/availability')
  @ApiOperation({
    summary: 'Gợi ý khung giờ trống cho dịch vụ và địa chỉ đã chọn',
    description:
      'Slots are advisory, not held. Suggestions respect the provider service radius, working hours, pending/confirmed bookings and travel buffers. A provider still must accept the order.',
  })
  @ApiStandardOk({
    description: 'Available 15-minute start times in Vietnam time.',
    data: {
      date: '2026-10-13',
      timezone: 'Asia/Ho_Chi_Minh',
      durationMinutes: 60,
      providerServiceId: 'provider-service-uuid',
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
