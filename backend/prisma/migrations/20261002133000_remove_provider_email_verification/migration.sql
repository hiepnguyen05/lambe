DROP TABLE IF EXISTS "provider_application_email_verifications";

ALTER TABLE "provider_applications"
  DROP COLUMN IF EXISTS "emailVerifiedAt";
