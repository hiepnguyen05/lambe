import { BadRequestException } from '@nestjs/common';
import { FeedMediaKind } from '@prisma/client';
import { validateFeedMedia } from './feed-media';

function file(buffer: Buffer): Express.Multer.File {
  return { buffer, size: buffer.length } as Express.Multer.File;
}

describe('validateFeedMedia', () => {
  it('accepts JPEG and PNG images', () => {
    const jpeg = file(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    const png = file(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(validateFeedMedia([jpeg, png])).toBe(FeedMediaKind.IMAGE);
  });

  it('accepts one MP4 and rejects mixed media', () => {
    const mp4 = file(Buffer.from('....ftypisom', 'ascii'));
    expect(validateFeedMedia([mp4])).toBe(FeedMediaKind.VIDEO);
    expect(() =>
      validateFeedMedia([mp4, file(Buffer.from([0xff, 0xd8, 0xff]))]),
    ).toThrow(BadRequestException);
  });

  it('rejects empty and spoofed files', () => {
    expect(() => validateFeedMedia([])).toThrow(BadRequestException);
    expect(() =>
      validateFeedMedia([file(Buffer.from('not-an-image'))]),
    ).toThrow(BadRequestException);
  });
});
