BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "service_orders"
  ADD COLUMN "expectedStartAt" TIMESTAMP(3),
  ADD COLUMN "expectedEndAt" TIMESTAMP(3),
  ADD COLUMN "clientRequestId" TEXT,
  ADD COLUMN "requestHash" TEXT;
UPDATE "service_orders" SET
  "expectedStartAt" = COALESCE("scheduledAt", "startedAt", "acceptedAt", "createdAt"),
  "expectedEndAt" = COALESCE("scheduledAt", "startedAt", "acceptedAt", "createdAt")
    + make_interval(mins => "durationMinutes");
ALTER TABLE "service_orders"
  ALTER COLUMN "expectedStartAt" SET NOT NULL,
  ALTER COLUMN "expectedEndAt" SET NOT NULL;
CREATE UNIQUE INDEX "service_orders_customerId_clientRequestId_key"
  ON "service_orders"("customerId", "clientRequestId");

CREATE TABLE "provider_calendar_blocks" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderId" TEXT UNIQUE REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "addressLatitude" DOUBLE PRECISION,
  "addressLongitude" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "holdExpiresAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_positive_interval" CHECK ("endAt" > "startAt"),
  CONSTRAINT "calendar_location_pair" CHECK (("addressLatitude" IS NULL) = ("addressLongitude" IS NULL))
);
CREATE INDEX "provider_calendar_blocks_providerId_active_startAt_idx"
  ON "provider_calendar_blocks"("providerId", "active", "startAt");
CREATE INDEX "provider_calendar_blocks_active_holdExpiresAt_idx"
  ON "provider_calendar_blocks"("active", "holdExpiresAt");

-- Preserve existing commitments. Migration intentionally fails on overlapping legacy bookings.
INSERT INTO "provider_calendar_blocks"
  ("id", "providerId", "orderId", "startAt", "endAt", "addressLatitude", "addressLongitude", "holdExpiresAt")
SELECT gen_random_uuid()::text, "providerId", "id", "expectedStartAt", "expectedEndAt",
       "addressLatitude", "addressLongitude",
       CASE WHEN "status" = 'PENDING_PROVIDER' THEN "providerResponseDeadlineAt" ELSE NULL END
FROM "service_orders"
WHERE "status" IN ('ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')
   OR ("status" = 'PENDING_PROVIDER' AND "providerResponseDeadlineAt" > CURRENT_TIMESTAMP);

-- Timestamps follow the existing schema's UTC TIMESTAMP(3) convention.
ALTER TABLE "provider_calendar_blocks" ADD CONSTRAINT "calendar_no_overlap"
  EXCLUDE USING gist ("providerId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("active");
CREATE INDEX "provider_service_area_point_idx" ON "provider_profiles"
  USING gist (point("serviceAreaLongitude", "serviceAreaLatitude"))
  WHERE "status" = 'ACTIVE' AND "setupCompletedAt" IS NOT NULL AND "serviceRadiusKm" IS NOT NULL;
COMMIT;
