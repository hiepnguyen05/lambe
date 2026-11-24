import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderTrackingService } from '../application/tracking/order-tracking.service';
import { OrderLocationDto } from '../dto/order-location.dto';
import { OrderParamDto } from '../dto/order.dto';

@ApiTags('Order Tracking')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/provider/orders')
export class ProviderOrderTrackingController {
  constructor(private readonly tracking: OrderTrackingService) {}

  @Put(':id/location')
  @HttpCode(200)
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 30, ttl: 60000 },
  })
  @ApiOperation({
    summary: 'Cập nhật GPS thật khi thợ đang di chuyển tới khách',
  })
  @ApiStandardOk({
    description: 'Vị trí mới đã được ghi nhận.',
    data: {
      accepted: true,
      tracking: {
        status: 'LIVE',
        position: {
          latitude: 21.02,
          longitude: 105.85,
          accuracyMeters: 12,
          capturedAt: '2026-10-20T06:00:00.000Z',
        },
        route: {
          coordinates: [
            [105.85, 21.02],
            [105.86, 21.03],
          ],
          distanceMeters: 1700,
          durationSeconds: 360,
        },
      },
    },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Đơn dịch vụ của thợ')
  @ApiValidationError()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() location: OrderLocationDto,
  ) {
    return this.tracking.update(user.userId, params.id, location);
  }
}

@ApiTags('Order Tracking')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/orders')
export class CustomerOrderTrackingController {
  constructor(private readonly tracking: OrderTrackingService) {}

  @Get(':id/tracking')
  @ApiOperation({
    summary: 'Lấy tọa độ GPS và tuyến đường hiện tại của thợ cho đơn của mình',
  })
  @ApiStandardOk({
    description:
      'Chỉ khách của đơn xem được. Không có vị trí giả khi thợ chưa phát GPS.',
    data: {
      status: 'LIVE',
      position: {
        latitude: 21.02,
        longitude: 105.85,
        accuracyMeters: 12,
        capturedAt: '2026-10-20T06:00:00.000Z',
      },
      route: {
        coordinates: [
          [105.85, 21.02],
          [105.86, 21.03],
        ],
        distanceMeters: 1700,
        durationSeconds: 360,
      },
    },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Đơn dịch vụ của khách')
  snapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
  ) {
    return this.tracking.getCustomerSnapshot(user.userId, params.id);
  }

  @Get(':id/tracking/events')
  @ApiOperation({
    summary: 'Luồng SSE vị trí thợ, tự đóng sau 30 giây để xác thực lại',
  })
  @ApiProduces('text/event-stream')
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Đơn dịch vụ của khách')
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Res() response: Response,
  ): Promise<void> {
    let lastPayload = JSON.stringify(
      await this.tracking.getCustomerSnapshot(user.userId, params.id),
    );
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || response.destroyed || response.writableEnded) return;
      refreshing = true;
      try {
        const snapshot = await this.tracking.getCustomerSnapshot(
          user.userId,
          params.id,
        );
        if (response.destroyed || response.writableEnded) return;
        const payload = JSON.stringify(snapshot);
        if (payload !== lastPayload) {
          lastPayload = payload;
          response.write(`data: ${payload}\n\n`);
        }
        if (snapshot.status === 'INACTIVE') response.end();
      } catch {
        response.end();
      } finally {
        refreshing = false;
      }
    };
    const unsubscribe = await this.tracking.subscribe(
      params.id,
      () => void refresh(),
    );
    if (response.destroyed) {
      await unsubscribe();
      return;
    }
    const timers: { poll?: NodeJS.Timeout; timeout?: NodeJS.Timeout } = {};
    response.once('close', () => {
      if (timers.poll) clearInterval(timers.poll);
      if (timers.timeout) clearTimeout(timers.timeout);
      void unsubscribe().catch(() => undefined);
    });
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write(`data: ${lastPayload}\n\n`);
    void refresh();

    timers.poll = setInterval(() => {
      void refresh();
      if (!response.destroyed && !response.writableEnded)
        response.write(': keepalive\n\n');
    }, 3000);
    timers.timeout = setTimeout(() => response.end(), 30_000);
  }
}
