BEGIN;
CREATE TYPE "FeedModerationStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE "FeedRecommendationStatus" AS ENUM ('INELIGIBLE','ELIGIBLE');
ALTER TABLE feed_posts
 ADD COLUMN "moderationStatus" "FeedModerationStatus" NOT NULL DEFAULT 'PENDING',
 ADD COLUMN "recommendationStatus" "FeedRecommendationStatus" NOT NULL DEFAULT 'INELIGIBLE',
 ADD COLUMN "moderationPolicyCode" VARCHAR(60),
 ADD COLUMN "moderationNote" VARCHAR(500),
 ADD COLUMN "moderationReviewedAt" TIMESTAMP(3),
 ADD COLUMN "moderationReviewedById" TEXT;
CREATE TABLE feed_moderation_decisions (
 id TEXT PRIMARY KEY, "postId" TEXT NOT NULL REFERENCES feed_posts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "revisionNumber" INTEGER NOT NULL, status "FeedModerationStatus" NOT NULL,
 "recommendationStatus" "FeedRecommendationStatus" NOT NULL,
 "policyCode" VARCHAR(60), note VARCHAR(500), "reviewerId" TEXT,
 source VARCHAR(30) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "feed_moderation_decisions_postId_createdAt_idx" ON feed_moderation_decisions("postId","createdAt");
-- Preserve visibility of legacy posts without claiming a human reviewed them.
UPDATE feed_posts SET "moderationStatus"='APPROVED', "recommendationStatus"='ELIGIBLE'
 WHERE status='PUBLISHED';
INSERT INTO feed_moderation_decisions(id,"postId","revisionNumber",status,"recommendationStatus",source)
 SELECT 'legacy-' || id,id,"revisionNumber","moderationStatus","recommendationStatus",'LEGACY_BACKFILL' FROM feed_posts;
CREATE INDEX feed_moderation_queue_idx ON feed_posts("moderationStatus","createdAt",id);
CREATE TABLE feed_moderation_appeals (
 id TEXT PRIMARY KEY, "postId" TEXT NOT NULL REFERENCES feed_posts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "revisionNumber" INTEGER NOT NULL, "userId" TEXT NOT NULL, reason VARCHAR(1000) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','UPHELD','REVERSED')),
 "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), note VARCHAR(500),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "feed_moderation_appeals_postId_revisionNumber_key" ON feed_moderation_appeals("postId","revisionNumber");
CREATE INDEX "feed_moderation_appeals_status_createdAt_idx" ON feed_moderation_appeals(status,"createdAt");
-- Existing all-column feed_posts trigger invalidates cached pages and snapshots.
COMMIT;
