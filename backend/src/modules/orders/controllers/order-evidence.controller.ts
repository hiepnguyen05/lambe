import {
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import {
  createImageUploadPipe,
  MAX_IMAGE_SIZE_BYTES,
} from '../../../common/http/files/image-upload.validation';
import {
  ApiAuthenticationErrors,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderEvidenceService } from '../application/evidence/order-evidence.service';
import {
  OrderEvidenceIdParamDto,
  OrderEvidenceLocationDto,
  OrderEvidenceParamDto,
} from '../dto/order-evidence.dto';

@ApiTags('Order Evidence')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class OrderEvidenceController {
  constructor(private readonly evidence: OrderEvidenceService) {}

  @Post('me/provider/orders/:id/evidence/:type')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 15, ttl: 60000 },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Thợ tải ảnh bằng chứng riêng tư cho bước của đơn' })
  @ApiStandardCreated({
    description: 'Đã lưu ảnh bằng chứng.',
    data: { id: 'uuid', type: 'ARRIVAL' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderEvidenceParamDto,
    @Query() location: OrderEvidenceLocationDto,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
  ) {
    return this.evidence.upload(
      user.userId,
      params.id,
      params.type,
      location,
      file.buffer,
    );
  }

  @Get('orders/:id/evidence/:evidenceId')
  @ApiOperation({
    summary: 'Khách hoặc thợ lấy liên kết xem ảnh bằng chứng có hạn',
  })
  @ApiStandardOk({
    description: 'Liên kết ảnh riêng tư có thời hạn.',
    data: { url: 'https://...' },
  })
  @ApiAuthenticationErrors()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderEvidenceIdParamDto,
  ) {
    return this.evidence.getDownload(user.userId, params.id, params.evidenceId);
  }
}
