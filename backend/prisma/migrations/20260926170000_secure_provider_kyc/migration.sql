ALTER TABLE "audit_logs" ADD COLUMN "actorUserId" TEXT;

ALTER TABLE "provider_applications"
ADD COLUMN "nationalIdEncrypted" TEXT,
ADD COLUMN "nationalIdHash" TEXT,
ADD COLUMN "nationalIdLast4" TEXT;

ALTER TABLE "provider_application_documents"
ADD COLUMN "fileFormat" TEXT,
ADD COLUMN "deliveryType" TEXT NOT NULL DEFAULT 'upload';

CREATE INDEX "audit_logs_actorUserId_createdAt_idx"
ON "audit_logs"("actorUserId", "createdAt");

CREATE UNIQUE INDEX "provider_applications_nationalIdHash_key"
ON "provider_applications"("nationalIdHash");

ALTER TABLE "provider_application_documents"
ADD CONSTRAINT "provider_application_documents_delivery_type_check"
CHECK ("deliveryType" IN ('upload', 'authenticated'));

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
