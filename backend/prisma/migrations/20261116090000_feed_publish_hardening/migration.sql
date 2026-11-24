BEGIN;

ALTER TABLE feed_posts
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "clientRequestId" TEXT,
  ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX feed_post_creator_request_key
  ON feed_posts("createdByUserId", "clientRequestId");

ALTER TABLE feed_posts ADD CONSTRAINT feed_post_request_identity_check CHECK (
  ("createdByUserId" IS NULL AND "clientRequestId" IS NULL AND "requestHash" IS NULL)
  OR ("createdByUserId" IS NOT NULL
    AND "clientRequestId" ~ '^[a-zA-Z0-9_-]{8,128}$'
    AND "requestHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE feed_media_cleanup (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "publicId" TEXT NOT NULL UNIQUE,
  kind "FeedMediaKind" NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX feed_media_cleanup_completed_failed_available_idx
  ON feed_media_cleanup("completedAt", "failedAt", "availableAt");

COMMIT;
