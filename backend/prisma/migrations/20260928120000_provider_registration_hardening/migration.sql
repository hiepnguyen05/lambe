ALTER TYPE "InternalRole" ADD VALUE 'SUPPORT';
ALTER TYPE "InternalRole" ADD VALUE 'KYC_REVIEWER';
ALTER TYPE "InternalRole" ADD VALUE 'SERVICE_REVIEWER';

ALTER TABLE "services"
  ADD COLUMN "requiresCertificate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minPortfolioImages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minExperienceYears" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "services_evidence_limits" CHECK (
    "minPortfolioImages" BETWEEN 0 AND 20 AND "minExperienceYears" BETWEEN 0 AND 80
  );

ALTER TABLE "provider_applications" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE TABLE "provider_application_email_verifications" (
  "applicationId" TEXT PRIMARY KEY REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "email" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "provider_identity_claims" (
  "nationalIdHash" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "provider_identity_claims_userId_idx" ON "provider_identity_claims"("userId");
INSERT INTO "provider_identity_claims" ("nationalIdHash", "userId")
SELECT "nationalIdHash", "userId" FROM "provider_applications" WHERE "nationalIdHash" IS NOT NULL;
DROP INDEX "provider_applications_nationalIdHash_key";
CREATE INDEX "provider_applications_nationalIdHash_idx" ON "provider_applications"("nationalIdHash");

CREATE TABLE "mail_outbox" (
  "id" TEXT PRIMARY KEY,
  "deduplicationKey" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "mail_outbox_deduplicationKey_key" ON "mail_outbox"("deduplicationKey");
CREATE INDEX "mail_outbox_sentAt_failedAt_availableAt_idx" ON "mail_outbox"("sentAt", "failedAt", "availableAt");

ALTER TABLE "provider_profiles"
  ADD COLUMN "serviceAreaName" TEXT,
  ADD COLUMN "serviceRadiusKm" INTEGER,
  ADD COLUMN "setupCompletedAt" TIMESTAMP(3),
  ADD CONSTRAINT "provider_profiles_radius_limit" CHECK ("serviceRadiusKm" BETWEEN 1 AND 50);

CREATE TABLE "provider_working_hours" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dayOfWeek" INTEGER NOT NULL CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  "startMinute" INTEGER NOT NULL CHECK ("startMinute" BETWEEN 0 AND 1439),
  "endMinute" INTEGER NOT NULL CHECK ("endMinute" BETWEEN 1 AND 1440 AND "endMinute" > "startMinute")
);
CREATE UNIQUE INDEX "provider_working_hours_providerId_dayOfWeek_startMinute_key" ON "provider_working_hours"("providerId", "dayOfWeek", "startMinute");
