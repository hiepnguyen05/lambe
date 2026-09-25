import { Inject, Injectable } from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
  type UploadResult,
} from './media-storage.port';

@Injectable()
export class UploadImageService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    buffer: Buffer,
    folder: string,
    actorId: string,
    request: RequestMetadata,
  ): Promise<UploadResult> {
    const result = await this.storage.uploadImage(buffer, `lambe/${folder}`);

    await this.auditService.record(
      {
        actorInternalAccountId: actorId,
        action: 'IMAGE_UPLOADED',
        resourceType: 'CloudinaryAsset',
        resourceId: result.publicId,
        result: 'SUCCESS',
        metadata: { folder, format: result.format },
      },
      request,
    );

    return result;
  }
}
