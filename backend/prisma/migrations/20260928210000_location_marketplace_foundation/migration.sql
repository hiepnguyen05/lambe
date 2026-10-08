ALTER TABLE "customer_addresses"
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "note" TEXT;

ALTER TABLE "provider_profiles"
ADD COLUMN "serviceAreaLatitude" DOUBLE PRECISION,
ADD COLUMN "serviceAreaLongitude" DOUBLE PRECISION;

CREATE TABLE "provider_availability_sessions" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    CONSTRAINT "provider_availability_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_availability_sessions_providerId_endedAt_idx"
ON "provider_availability_sessions"("providerId", "endedAt");

CREATE INDEX "provider_availability_sessions_lastHeartbeatAt_idx"
ON "provider_availability_sessions"("lastHeartbeatAt");

CREATE UNIQUE INDEX "provider_availability_sessions_one_active_per_provider"
ON "provider_availability_sessions"("providerId")
WHERE "endedAt" IS NULL;

WITH ranked_defaults AS (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "userId"
               ORDER BY "updatedAt" DESC, "id" DESC
           ) AS row_number
    FROM "customer_addresses"
    WHERE "isDefault" = true
)
UPDATE "customer_addresses"
SET "isDefault" = false
WHERE "id" IN (
    SELECT "id" FROM ranked_defaults WHERE row_number > 1
);

CREATE UNIQUE INDEX "customer_addresses_one_default_per_user"
ON "customer_addresses"("userId")
WHERE "isDefault" = true;

ALTER TABLE "provider_availability_sessions"
ADD CONSTRAINT "provider_availability_sessions_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
