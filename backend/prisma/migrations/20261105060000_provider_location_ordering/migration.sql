ALTER TABLE "provider_availability_sessions"
ADD COLUMN "lastCapturedAt" TIMESTAMP(3),
ADD COLUMN "lastSequence" BIGINT NOT NULL DEFAULT 0;
