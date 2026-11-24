import { BadRequestException } from '@nestjs/common';
import { ChatImagesUploadPipe } from './chat-images-upload.pipe';

const file = (buffer: Buffer, mimetype: string): Express.Multer.File =>
  ({
    buffer,
    mimetype,
    size: buffer.length,
    fieldname: 'files',
    originalname: 'image',
    encoding: '7bit',
    stream: undefined,
    destination: '',
    filename: '',
    path: '',
  }) as unknown as Express.Multer.File;

describe('ChatImagesUploadPipe', () => {
  const pipe = new ChatImagesUploadPipe();

  it('accepts JPEG content matching its declared MIME type', () => {
    const image = file(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg');
    expect(pipe.transform([image])).toEqual([image]);
  });

  it('rejects content without a supported image signature', () => {
    const image = file(Buffer.from('not-an-image'), 'image/jpeg');
    expect(() => pipe.transform([image])).toThrow(BadRequestException);
  });

  it('rejects more than four images', () => {
    const image = file(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg');
    expect(() => pipe.transform(Array(5).fill(image))).toThrow(
      BadRequestException,
    );
  });
});
