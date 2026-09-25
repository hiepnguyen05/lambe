import cloudinaryConfig from './cloudinary.config';

describe('cloudinaryConfig', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('is disabled and does not contain built-in credentials by default', () => {
    delete process.env.CLOUDINARY_ENABLED;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_UPLOAD_PRESET;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    expect(cloudinaryConfig()).toEqual({
      enabled: false,
      cloudName: '',
      uploadPreset: '',
      apiKey: '',
      apiSecret: '',
    });
  });

  it('reads explicitly supplied Cloudinary settings', () => {
    process.env.CLOUDINARY_ENABLED = 'true';
    process.env.CLOUDINARY_CLOUD_NAME = 'lambe-cloud';
    process.env.CLOUDINARY_UPLOAD_PRESET = 'lambe';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';

    expect(cloudinaryConfig()).toMatchObject({
      enabled: true,
      cloudName: 'lambe-cloud',
      uploadPreset: 'lambe',
      apiKey: 'key',
      apiSecret: 'secret',
    });
  });
});
