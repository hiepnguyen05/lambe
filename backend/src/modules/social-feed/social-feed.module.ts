import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { CloudinaryService } from '../../infrastructure/upload/cloudinary.service';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { FeedPostsService } from './application/feed-posts.service';
import { FEED_MEDIA_STORAGE } from './application/feed-media-storage.port';
import { FeedQueryService } from './application/feed-query.service';
import { FeedSocialService } from './application/feed-social.service';
import { FeedModerationService } from './application/feed-moderation.service';
import { PublicFeedController } from './controllers/public-feed.controller';
import { MyFeedController } from './controllers/my-feed.controller';
import { InternalFeedController } from './controllers/internal-feed.controller';
import { FeedAccessService } from './application/organization/feed-access.service';
import { OrganizationFeedReviewService } from './application/organization/organization-feed-review.service';
import { OrganizationFeedController } from './controllers/organization-feed.controller';
import { FeedMediaCleanupService } from './application/feed-media-cleanup.service';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { FeedCacheService } from './application/feed-cache.service';
import { FeedTimelineService } from './application/feed-timeline.service';
import { FeedCacheWorkerService } from './application/feed-cache-worker.service';
import { FeedCacheOperationsController } from './controllers/feed-cache-operations.controller';
import { FeedCacheAlertsService } from './application/feed-cache-alerts.service';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { FeedRecommendationController } from './controllers/feed-recommendation.controller';
import { FeedRecommendationService } from './application/feed-recommendation.service';
import { FeedLiveReadService } from './application/feed-live-read.service';
import { FeedReviewService } from './application/feed-review.service';
import { FeedSafetyService } from './application/feed-safety.service';
import { FeedOperationsService } from './application/feed-operations.service';

@Module({
  imports: [
    PostgresModule,
    AuthModule,
    InternalAuthModule,
    UploadModule,
    AuditModule,
    CacheModule,
    MailModule,
  ],
  controllers: [
    PublicFeedController,
    MyFeedController,
    InternalFeedController,
    OrganizationFeedController,
    FeedCacheOperationsController,
    FeedRecommendationController,
  ],
  providers: [
    FeedReviewService,
    FeedSafetyService,
    FeedOperationsService,
    FeedAccessService,
    OrganizationFeedReviewService,
    FeedPostsService,
    FeedQueryService,
    FeedLiveReadService,
    FeedCacheService,
    FeedTimelineService,
    FeedCacheWorkerService,
    FeedCacheAlertsService,
    FeedRecommendationService,
    FeedSocialService,
    FeedModerationService,
    { provide: FEED_MEDIA_STORAGE, useExisting: CloudinaryService },
    FeedMediaCleanupService,
  ],
})
export class SocialFeedModule {}
