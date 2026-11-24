CREATE TYPE "FeedPostStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');
CREATE TYPE "FeedMediaKind" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "FeedReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE', 'PRIVACY', 'MISLEADING', 'OTHER');
CREATE TYPE "FeedReportResolution" AS ENUM ('DISMISSED', 'POST_HIDDEN');

CREATE TABLE "feed_posts" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "caption" VARCHAR(2000) NOT NULL,
  "includesCustomer" BOOLEAN NOT NULL DEFAULT false,
  "status" "FeedPostStatus" NOT NULL DEFAULT 'PUBLISHED',
  "hasCustomerConsent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "feed_post_media" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "kind" "FeedMediaKind" NOT NULL,
  "publicId" TEXT NOT NULL,
  "secureUrl" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "durationSeconds" DOUBLE PRECISION,
  "position" INTEGER NOT NULL,
  CONSTRAINT "feed_post_media_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "feed_post_services" (
  "postId" TEXT NOT NULL,
  "providerServiceId" TEXT NOT NULL,
  CONSTRAINT "feed_post_services_pkey" PRIMARY KEY ("postId", "providerServiceId")
);
CREATE TABLE "feed_likes" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feed_likes_pkey" PRIMARY KEY ("postId", "userId")
);
CREATE TABLE "feed_saves" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feed_saves_pkey" PRIMARY KEY ("postId", "userId")
);
CREATE TABLE "provider_follows" (
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_follows_pkey" PRIMARY KEY ("providerId", "userId")
);
CREATE TABLE "feed_comments" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "text" VARCHAR(1000) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feed_comments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "feed_reports" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" "FeedReportReason" NOT NULL,
  "detail" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolution" "FeedReportResolution",
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "feed_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feed_posts_status_createdAt_id_idx" ON "feed_posts"("status", "createdAt" DESC, "id" DESC);
CREATE INDEX "feed_posts_providerId_status_createdAt_idx" ON "feed_posts"("providerId", "status", "createdAt" DESC);
CREATE UNIQUE INDEX "feed_post_media_publicId_key" ON "feed_post_media"("publicId");
CREATE UNIQUE INDEX "feed_post_media_postId_position_key" ON "feed_post_media"("postId", "position");
CREATE INDEX "feed_post_services_providerServiceId_idx" ON "feed_post_services"("providerServiceId");
CREATE INDEX "feed_likes_userId_createdAt_idx" ON "feed_likes"("userId", "createdAt" DESC);
CREATE INDEX "feed_saves_userId_createdAt_idx" ON "feed_saves"("userId", "createdAt" DESC);
CREATE INDEX "provider_follows_userId_createdAt_idx" ON "provider_follows"("userId", "createdAt" DESC);
CREATE INDEX "feed_comments_postId_createdAt_id_idx" ON "feed_comments"("postId", "createdAt", "id");
CREATE INDEX "feed_comments_parentId_idx" ON "feed_comments"("parentId");
CREATE UNIQUE INDEX "feed_reports_postId_userId_key" ON "feed_reports"("postId", "userId");
CREATE INDEX "feed_reports_createdAt_idx" ON "feed_reports"("createdAt" DESC);
CREATE INDEX "feed_reports_resolution_createdAt_idx" ON "feed_reports"("resolution", "createdAt" DESC);

ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_post_media" ADD CONSTRAINT "feed_post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_post_services" ADD CONSTRAINT "feed_post_services_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_post_services" ADD CONSTRAINT "feed_post_services_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_likes" ADD CONSTRAINT "feed_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_likes" ADD CONSTRAINT "feed_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_saves" ADD CONSTRAINT "feed_saves_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_saves" ADD CONSTRAINT "feed_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_follows" ADD CONSTRAINT "provider_follows_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_follows" ADD CONSTRAINT "provider_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "feed_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feed_reports" ADD CONSTRAINT "feed_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_reports" ADD CONSTRAINT "feed_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feed_reports" ADD CONSTRAINT "feed_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
