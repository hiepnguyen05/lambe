-- OTP codes are short-lived credentials. Existing plaintext codes are invalidated
-- before replacing the column with a non-reversible hash.
DELETE FROM "otp_codes";

DROP INDEX "otp_codes_phone_code_idx";

ALTER TABLE "otp_codes"
DROP COLUMN "code",
ADD COLUMN "codeHash" TEXT NOT NULL,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "otp_codes_phone_createdAt_idx" ON "otp_codes"("phone", "createdAt");
