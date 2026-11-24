import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PushDevicesService } from '../application/push-devices.service';
import { RegisterPushDeviceDto } from '../dto/register-push-device.dto';

@ApiTags('Push Devices')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/push-devices')
export class PushDevicesController {
  constructor(private readonly devices: PushDevicesService) {}

  @Put()
  @ApiOperation({
    summary: 'Đăng ký hoặc cập nhật thiết bị nhận thông báo đẩy',
  })
  @ApiStandardOk({
    description: 'Thiết bị đã được đăng ký. Không trả token FCM.',
    data: {
      id: 'uuid',
      platform: 'ANDROID',
      deviceId: 'installation-id',
      appVersion: '1.0.0',
      lastSeenAt: '2026-10-26T00:00:00.000Z',
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return this.devices.register(user.userId, user.sessionId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Ngừng nhận thông báo đẩy trên thiết bị thuộc tài khoản',
  })
  @ApiStandardOk({ description: 'Đã thu hồi thiết bị.', data: null })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Thiết bị')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devices.revoke(user.userId, id);
  }
}
