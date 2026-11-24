import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import 'multer';

export const MAX_CHAT_IMAGES = 4;
export const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function detectImageMimeType(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

@Injectable()
export class ChatImagesUploadPipe implements PipeTransform<
  Express.Multer.File[],
  Express.Multer.File[]
> {
  transform(files: Express.Multer.File[] | undefined): Express.Multer.File[] {
    if (!files?.length)
      throw new BadRequestException('Cần chọn ít nhất một ảnh.');
    if (files.length > MAX_CHAT_IMAGES)
      throw new BadRequestException(
        `Chỉ được gửi tối đa ${MAX_CHAT_IMAGES} ảnh.`,
      );

    for (const file of files) {
      if (!Buffer.isBuffer(file.buffer) || file.size < 1)
        throw new BadRequestException('File ảnh không hợp lệ.');
      if (file.size > MAX_CHAT_IMAGE_SIZE_BYTES)
        throw new BadRequestException('Mỗi ảnh không được vượt quá 5 MB.');

      const detectedMimeType = detectImageMimeType(file.buffer);
      if (!detectedMimeType) {
        throw new BadRequestException(
          'Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP hợp lệ.',
        );
      }
    }

    return files;
  }
}
