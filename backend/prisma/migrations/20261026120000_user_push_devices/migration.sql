CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS');

CREATE TABLE "user_push_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "deviceId" VARCHAR(128) NOT NULL,
    "token" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "appVersion" VARCHAR(64),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_push_devices_tokenHash_key" ON "user_push_devices"("tokenHash");
CREATE UNIQUE INDEX "user_push_devices_active_installation_key"
    ON "user_push_devices"("userId", "platform", "deviceId")
    WHERE "revokedAt" IS NULL;
CREATE INDEX "user_push_devices_userId_platform_deviceId_idx" ON "user_push_devices"("userId", "platform", "deviceId");
CREATE INDEX "user_push_devices_userId_revokedAt_idx" ON "user_push_devices"("userId", "revokedAt");
CREATE INDEX "user_push_devices_sessionId_revokedAt_idx" ON "user_push_devices"("sessionId", "revokedAt");
ALTER TABLE "user_push_devices" ADD CONSTRAINT "user_push_devices_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
