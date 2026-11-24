import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import 'multer';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  createImageUploadPipe,
  MAX_IMAGE_SIZE_BYTES,
} from '../../../common/http/files/image-upload.validation';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderSafetyEvidenceService } from '../application/safety/order-safety-evidence.service';
import { OrderSafetyService } from '../application/safety/order-safety.service';
import {
  OrderSafetyEvidenceParamDto,
  OrderSafetyParamDto,
  RaiseOrderSafetyDto,
} from '../dto/order-safety.dto';

@ApiTags('Order Safety')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class OrderSafetyController {
  constructor(
    private readonly safety: OrderSafetyService,
    private readonly evidence: OrderSafetyEvidenceService,
  ) {}

  @Post('me/orders/:id/safety/sos')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Khách báo SOS cho đơn đang thực hiện, không yêu cầu ảnh',
  })
  @ApiBody({ type: RaiseOrderSafetyDto, required: false })
  @ApiStandardOk({
    description: 'Đơn được tạm dừng chờ hỗ trợ.',
    data: { id: 'incident-uuid', status: 'OPEN' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  customerSos(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyParamDto,
    @Body() dto: RaiseOrderSafetyDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.safety.raise(user.userId, params.id, dto ?? {}, metadata);
  }

  @Post('me/provider/orders/:id/safety/sos')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Thợ báo SOS cho đơn đang thực hiện, không yêu cầu ảnh',
  })
  @ApiBody({ type: RaiseOrderSafetyDto, required: false })
  @ApiStandardOk({
    description: 'Đơn được tạm dừng chờ hỗ trợ.',
    data: { id: 'incident-uuid', status: 'OPEN' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  providerSos(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyParamDto,
    @Body() dto: RaiseOrderSafetyDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.safety.raise(user.userId, params.id, dto ?? {}, metadata);
  }

  @Get('me/orders/:id/safety')
  @ApiOperation({ summary: 'Khách xem trạng thái sự cố và báo cáo của mình' })
  @ApiStandardOk({
    description: 'Không trả báo cáo hoặc ảnh của bên còn lại.',
    data: { status: 'OPEN' },
  })
  customerIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyParamDto,
  ) {
    return this.safety.mine(user.userId, params.id);
  }

  @Get('me/provider/orders/:id/safety')
  @ApiOperation({ summary: 'Thợ xem trạng thái sự cố và báo cáo của mình' })
  @ApiStandardOk({
    description: 'Không trả báo cáo hoặc ảnh của bên còn lại.',
    data: { status: 'OPEN' },
  })
  providerIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyParamDto,
  ) {
    return this.safety.mine(user.userId, params.id);
  }

  @Post('me/orders/:id/safety/evidence')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Khách bổ sung ảnh riêng tư sau khi đã an toàn' })
  @ApiStandardCreated({
    description: 'Đã ghi nhận ảnh bằng chứng.',
    data: { id: 'evidence-uuid' },
  })
  customerEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyParamDto,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
  ) {
    return this.evidence.upload(user.userId, params.id, file.buffer);
  }

  @Post('me/provider/orders/:id/safety/evidence')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Thợ bổ sung ảnh riêng tư sau khi đã an toàn' })
  @ApiStandardCreated({
    description: 'Đã ghi nhận ảnh bằng chứng.',
    data: { id: 'evidence-uuid' },
  })
  providerEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyParamDto,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
  ) {
    return this.evidence.upload(user.userId, params.id, file.buffer);
  }

  @Get('me/orders/:id/safety/evidence/:evidenceId')
  @ApiOperation({ summary: 'Khách xem ảnh bằng chứng do mình tải lên' })
  customerEvidenceUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyEvidenceParamDto,
  ) {
    return this.evidence.ownDownload(user.userId, params.id, params.evidenceId);
  }

  @Get('me/provider/orders/:id/safety/evidence/:evidenceId')
  @ApiOperation({ summary: 'Thợ xem ảnh bằng chứng do mình tải lên' })
  providerEvidenceUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderSafetyEvidenceParamDto,
  ) {
    return this.evidence.ownDownload(user.userId, params.id, params.evidenceId);
  }
}
