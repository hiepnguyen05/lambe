import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CloudinaryService } from '../../infrastructure/upload/cloudinary.service';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { MEDIA_STORAGE } from './application/media-storage.port';
import { UploadImageService } from './application/upload-image.service';
import { UploadController } from './controllers/upload.controller';

@Module({
  imports: [InternalAuthModule, AuditModule],
  controllers: [UploadController],
  providers: [
    CloudinaryService,
    { provide: MEDIA_STORAGE, useExisting: CloudinaryService },
    UploadImageService,
  ],
  exports: [MEDIA_STORAGE],
})
export class UploadModule {}
