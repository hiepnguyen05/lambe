BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "provider_applications"
    WHERE "nationalIdNumber" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Refusing to drop legacy nationalIdNumber: plaintext KYC records remain';
  END IF;
END $$;

ALTER TABLE "provider_applications" DROP COLUMN "nationalIdNumber";

COMMIT;
