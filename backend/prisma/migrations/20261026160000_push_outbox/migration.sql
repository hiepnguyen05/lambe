CREATE TABLE "push_outbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deduplicationKey" VARCHAR(200) NOT NULL,
    "event" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(30) NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientRole" VARCHAR(20) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_outbox_deduplicationKey_key" ON "push_outbox"("deduplicationKey");
CREATE INDEX "push_outbox_availableAt_lockedUntil_idx" ON "push_outbox"("availableAt", "lockedUntil");
CREATE INDEX "push_outbox_userId_createdAt_idx" ON "push_outbox"("userId", "createdAt");
ALTER TABLE "push_outbox" ADD CONSTRAINT "push_outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_notifications" ADD COLUMN "pushQueuedAt" TIMESTAMP(3);
UPDATE "order_notifications" SET "pushQueuedAt" = CURRENT_TIMESTAMP WHERE "pushQueuedAt" IS NULL;
CREATE INDEX "order_notifications_pushQueuedAt_createdAt_idx" ON "order_notifications"("pushQueuedAt", "createdAt");
