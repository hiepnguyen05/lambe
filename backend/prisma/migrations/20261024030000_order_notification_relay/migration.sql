ALTER TABLE "order_notifications" ADD COLUMN "publishedAt" TIMESTAMP(3);
UPDATE "order_notifications" SET "publishedAt" = NOW();
CREATE INDEX "order_notifications_publishedAt_createdAt_idx" ON "order_notifications"("publishedAt", "createdAt");
