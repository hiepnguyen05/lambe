import { ServiceUnavailableException } from '@nestjs/common';
import type { FeedMediaStorage } from './feed-media-storage.port';
export function feedMediaUrl(
  media: {
    secureUrl: string;
    publicId?: string;
    format?: string;
    kind: string;
    deliveryType?: string;
  },
  storage?: FeedMediaStorage,
) {
  if (media.deliveryType !== 'authenticated') return media.secureUrl;
  if (!media.publicId || !media.format || !storage?.createFeedDownloadUrl)
    throw new ServiceUnavailableException('Không cấp được liên kết xem media.');
  return storage.createFeedDownloadUrl(
    media.publicId,
    media.format,
    media.kind,
  );
}
