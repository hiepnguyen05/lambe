import { ImageContentValidator } from './image-upload.validation';

describe('ImageContentValidator', () => {
  const validator = new ImageContentValidator();
  const file = (buffer: Buffer) => ({ buffer }) as Express.Multer.File;

  it.each([
    Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('GIF89a', 'ascii'),
    Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.alloc(4),
      Buffer.from('WEBP', 'ascii'),
    ]),
  ])('accepts a supported image signature', (buffer) => {
    expect(validator.isValid(file(buffer))).toBe(true);
  });

  it('rejects content that only claims to be an image', () => {
    expect(
      validator.isValid(file(Buffer.from('<script>alert(1)</script>'))),
    ).toBe(false);
  });
});
