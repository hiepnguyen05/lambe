import { FileValidator, ParseFilePipeBuilder } from '@nestjs/common';
import 'multer';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export class ImageContentValidator extends FileValidator<
  { allowSvg: boolean },
  Express.Multer.File
> {
  constructor(options: { allowSvg?: boolean } = {}) {
    super({ allowSvg: options.allowSvg ?? true });
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
    const isSvg = (() => {
      if (buffer.length < 10) return false;
      const sample = buffer
        .subarray(0, Math.min(buffer.length, 1024))
        .toString('utf8')
        .trim()
        .toLowerCase();
      if (!sample.includes('<svg') && !sample.startsWith('<?xml')) return false;
      const fullText = buffer.toString('utf8').toLowerCase();
      if (
        fullText.includes('<script') ||
        fullText.includes('javascript:') ||
        /on[a-z]+\s*=/i.test(fullText)
      ) {
        return false;
      }
      return fullText.includes('</svg>');
    })();

    return (
      isJpeg ||
      isPng ||
      isGif ||
      isWebp ||
      (this.validationOptions.allowSvg && isSvg)
    );
  }

  buildErrorMessage(): string {
    return this.validationOptions.allowSvg
      ? 'Nội dung file phải là ảnh JPEG, PNG, WEBP, GIF hoặc SVG hợp lệ.'
      : 'Giấy tờ phải là ảnh JPEG, PNG, WEBP hoặc GIF hợp lệ.';
  }
}

export function createImageUploadPipe(options: { allowSvg?: boolean } = {}) {
  return new ParseFilePipeBuilder()
    .addMaxSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES })
    .addValidator(new ImageContentValidator(options))
    .build({ fileIsRequired: true });
}
