import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

function privateAssetUrl(value: unknown): string {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid private asset response');
  const asset = value as Record<string, unknown>;
  if (
    asset.type !== 'authenticated' ||
    typeof asset.secure_url !== 'string' ||
    !asset.secure_url.startsWith('https://')
  )
    throw new Error('Cannot verify private asset');
  return asset.secure_url;
}

// Default is read-only. Run only after migrations and while Feed writes/workers are paused.
async function main() {
  loadEnv({ quiet: true });
  const run = process.argv.includes('--run');
  const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (
    run &&
    (!process.argv.includes('--writes-paused') ||
      !process.argv.includes(`--database=${database}`))
  )
    throw new Error('Explicit database and paused writes required');
  const prisma = new PrismaClient();
  let converted = 0;
  try {
    const pending = await prisma.feedPostMedia.count({
      where: { deliveryType: 'upload' },
    });
    if (!run) {
      console.log(JSON.stringify({ dryRun: true, pending, database }));
      return;
    }
    if (process.env.CLOUDINARY_ENABLED !== 'true')
      throw new Error('Cloudinary required');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    while (true) {
      const media = await prisma.feedPostMedia.findFirst({
        where: { deliveryType: 'upload' },
        orderBy: { id: 'asc' },
      });
      if (!media) break;
      const resource_type = media.kind === 'VIDEO' ? 'video' : 'image';
      let secureUrl: string;
      try {
        const result: unknown = await cloudinary.uploader.rename(
          media.publicId,
          media.publicId,
          {
            resource_type,
            type: 'upload',
            to_type: 'authenticated',
            invalidate: true,
            overwrite: false,
          },
        );
        secureUrl = privateAssetUrl(result);
      } catch {
        // Resume a prior remote success followed by DB failure; never fall back to public delivery.
        const existing: unknown = await cloudinary.api.resource(
          media.publicId,
          {
            resource_type,
            type: 'authenticated',
          },
        );
        secureUrl = privateAssetUrl(existing);
      }
      await prisma.$transaction(async (tx) => {
        await tx.feedPostMedia.update({
          where: { id: media.id },
          data: { deliveryType: 'authenticated', secureUrl },
        });
        await tx.feedMediaCleanup.updateMany({
          where: { publicId: media.publicId, completedAt: null },
          data: { deliveryType: 'authenticated' },
        });
        await tx.feedPost.update({
          where: { id: media.postId },
          data: { updatedAt: new Date() },
        });
      });
      converted++;
    }
    console.log(JSON.stringify({ dryRun: false, converted, database }));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  console.error(
    'Private media migration stopped. Resume after verifying DB/provider state; raw URLs and credentials are omitted.',
  );
  process.exitCode = 1;
});
