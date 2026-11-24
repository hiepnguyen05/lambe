CREATE TABLE feed_engagements (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "postId" TEXT NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "clientEventId" TEXT NOT NULL,
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('VIEW','DWELL','SKIP','OPEN_SERVICE','START_BOOKING')),
  "durationMs" INTEGER CHECK ("durationMs" IS NULL OR "durationMs" BETWEEN 0 AND 300000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","clientEventId")
);
CREATE INDEX feed_engagements_user_created_idx ON feed_engagements("userId","createdAt");
CREATE INDEX feed_engagements_post_created_idx ON feed_engagements("postId","createdAt");
