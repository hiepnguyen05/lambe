import {
  Controller,
  ParseFilePipeBuilder,
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
import { InternalRole } from '@prisma/client';
import 'multer';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { UploadImageService } from '../application/upload-image.service';
import { UploadImageQueryDto } from '../dto/upload-image-query.dto';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('Admin Upload')
@ApiBearerAuth('internal-token')
@Controller('admin/upload')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.MODERATOR)
export class UploadController {
  constructor(private readonly uploadImageService: UploadImageService) {}

  @Post('image')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 30, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Upload an image for managed Lambe content' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, WEBP, or GIF; maximum 5 MB',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES })
        .addFileTypeValidator({ fileType: /(jpeg|png|gif|webp)$/ })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Query() query: UploadImageQueryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.uploadImageService.execute(
      file.buffer,
      query.folder,
      account.accountId,
      request,
    );
  }
}
