import { FileValidator, ParseFilePipeBuilder } from '@nestjs/common';
import 'multer';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export class ImageContentValidator extends FileValidator<
  Record<string, never>,
  Express.Multer.File
> {
  constructor() {
    super({});
  }

  isValid(
    input?:
      | Express.Multer.File
      | Express.Multer.File[]
      | Record<string, Express.Multer.File[]>,
  ): boolean {
    if (!input || Array.isArray(input)) return false;

    const buffer = (input as { buffer?: unknown }).buffer;
    if (!Buffer.isBuffer(buffer)) return false;
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isPng =
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const signature = buffer.subarray(0, 6).toString('ascii');
    const isGif = signature === 'GIF87a' || signature === 'GIF89a';
    const isWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isGif || isWebp;
  }

  buildErrorMessage(): string {
    return 'Nội dung file phải là ảnh JPEG, PNG, WEBP hoặc GIF hợp lệ.';
  }
}

export function createImageUploadPipe() {
  return new ParseFilePipeBuilder()
    .addMaxSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES })
    .addValidator(new ImageContentValidator())
    .build({ fileIsRequired: true });
}
