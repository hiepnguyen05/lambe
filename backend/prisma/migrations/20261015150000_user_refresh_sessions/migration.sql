CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_sessions_refreshTokenHash_key"
ON "user_sessions"("refreshTokenHash");

CREATE INDEX "user_sessions_userId_revokedAt_expiresAt_idx"
ON "user_sessions"("userId", "revokedAt", "expiresAt");

CREATE INDEX "user_sessions_expiresAt_idx"
ON "user_sessions"("expiresAt");

CREATE INDEX "user_sessions_revokedAt_idx"
ON "user_sessions"("revokedAt");

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
