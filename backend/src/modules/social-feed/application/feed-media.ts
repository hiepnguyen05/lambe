import { BadRequestException } from '@nestjs/common';
import { FeedMediaKind } from '@prisma/client';
import 'multer';

export const MAX_FEED_FILES = 6;
export const MAX_FEED_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FEED_VIDEO_BYTES = 30 * 1024 * 1024;

export function validateFeedMedia(files: Express.Multer.File[]): FeedMediaKind {
  if (!files?.length || files.length > MAX_FEED_FILES) {
    throw new BadRequestException('Bài đăng cần 1-6 ảnh hoặc một video.');
  }
  const isMp4 = (buffer: Buffer) =>
    buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
  if (files.length === 1 && isMp4(files[0].buffer)) {
    if (files[0].size > MAX_FEED_VIDEO_BYTES) {
      throw new BadRequestException('Video không được vượt quá 30 MB.');
    }
    return FeedMediaKind.VIDEO;
  }
  let totalBytes = 0;
  for (const file of files) {
    if (
      !Buffer.isBuffer(file.buffer) ||
      file.size < 1 ||
      file.size > MAX_FEED_IMAGE_BYTES
    ) {
      throw new BadRequestException('Mỗi ảnh phải hợp lệ và không quá 5 MB.');
    }
    const b = file.buffer;
    const jpeg =
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const png =
      b.length >= 8 &&
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp =
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp) {
      throw new BadRequestException(
        'Chỉ chấp nhận ảnh JPEG, PNG, WEBP hoặc một video MP4.',
      );
    }
    totalBytes += file.size;
  }
  if (totalBytes > MAX_FEED_VIDEO_BYTES) {
    throw new BadRequestException(
      'Tổng dung lượng ảnh không được vượt quá 30 MB.',
    );
  }
  return FeedMediaKind.IMAGE;
}
