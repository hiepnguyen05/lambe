import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import cloudinaryConfig from '../src/config/cloudinary.config';
import { CloudinaryService } from '../src/infrastructure/upload/cloudinary.service';

async function main() {
  if (!process.argv.includes('--run'))
    throw new Error('Explicit --run required');
  loadEnv({ quiet: true });
  if (process.env.CLOUDINARY_ENABLED !== 'true')
    throw new Error('Cloudinary is not enabled');
  const settings = cloudinaryConfig();
  const storage = new CloudinaryService(
    new ConfigService({ cloudinary: settings }),
  );
  const folder = `lambe/feed-verification/${randomUUID()}`;
  const video = process.argv.includes('--video');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOQAAAABJRU5ErkJggg==',
    'base64',
  );
  let asset:
    { publicId: string; secureUrl: string; format: string } | undefined;
  let passed = false;
  let stage = 'upload';
  try {
    asset = video
      ? await storage.uploadFeedVideo(
          execFileSync(
            'ffmpeg',
            [
              '-hide_banner',
              '-loglevel',
              'error',
              '-f',
              'lavfi',
              '-i',
              'color=c=black:s=16x16:d=1',
              '-c:v',
              'libx264',
              '-movflags',
              'frag_keyframe+empty_moov',
              '-f',
              'mp4',
              'pipe:1',
            ],
            { maxBuffer: 1024 * 1024 },
          ),
          folder,
        )
      : await storage.uploadFeedImage(png, folder);
    stage = 'unsigned-access';
    const unsigned = cloudinary.url(asset.publicId, {
      format: asset.format,
      resource_type: video ? 'video' : 'image',
      type: 'authenticated',
      secure: true,
      sign_url: false,
    });
    const publicResponse = await fetch(unsigned, {
      signal: AbortSignal.timeout(15000),
    });
    if (publicResponse.ok) throw new Error('Unsigned URL must be denied');
    stage = 'signed-access';
    const signedResponse = await fetch(
      storage.createFeedDownloadUrl(
        asset.publicId,
        asset.format,
        video ? 'VIDEO' : 'IMAGE',
      ),
      { signal: AbortSignal.timeout(15000) },
    );
    if (!signedResponse.ok) throw new Error('Signed URL must work');
    await signedResponse.arrayBuffer();
    stage = 'expired-access';
    const expired = cloudinary.utils.private_download_url(
      asset.publicId,
      asset.format,
      {
        resource_type: video ? 'video' : 'image',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) - 600,
        attachment: false,
      },
    );
    if ((await fetch(expired, { signal: AbortSignal.timeout(15000) })).ok)
      throw new Error('Expired URL must be denied');
    passed = true;
  } finally {
    const removed = asset
      ? video
        ? await storage.deleteFeedVideo(asset.publicId, 'authenticated')
        : await storage.deleteImage(asset.publicId, 'authenticated')
      : true;
    if (!removed) process.exitCode = 1;
    console.log(
      JSON.stringify({
        passed: passed && removed,
        stage,
        syntheticAssetRemoved: removed,
        scope: video
          ? 'one synthetic black MP4; no business database writes'
          : 'one synthetic PNG; no business database writes',
      }),
    );
  }
}
void main().catch(() => {
  console.error(
    'Private media verification failed. Credentials and signed URLs are intentionally omitted.',
  );
  process.exitCode = 1;
});
