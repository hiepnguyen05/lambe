CREATE TYPE "ProviderServiceChangeType" AS ENUM ('ADD_EXISTING_SERVICE', 'UPDATE_OFFERING', 'PROPOSE_NEW_SERVICE');
CREATE TYPE "ProviderServiceChangeStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'WITHDRAWN');

ALTER TABLE "provider_services" ADD COLUMN "suspensionReason" TEXT;
ALTER TABLE "provider_services" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE TABLE "provider_service_change_requests" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerServiceId" TEXT,
  "serviceId" TEXT,
  "categoryId" TEXT,
  "type" "ProviderServiceChangeType" NOT NULL,
  "status" "ProviderServiceChangeStatus" NOT NULL DEFAULT 'DRAFT',
  "proposedName" TEXT,
  "normalizedName" TEXT,
  "proposedPriceAmount" INTEGER NOT NULL,
  "proposedDurationMinutes" INTEGER,
  "proposedDescription" TEXT,
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_service_change_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_service_changes_positive_price" CHECK ("proposedPriceAmount" > 0),
  CONSTRAINT "provider_service_changes_target" CHECK (
    ("type" = 'UPDATE_OFFERING' AND "providerServiceId" IS NOT NULL AND "serviceId" IS NOT NULL AND "categoryId" IS NULL AND "proposedName" IS NULL) OR
    ("type" = 'ADD_EXISTING_SERVICE' AND "providerServiceId" IS NULL AND "serviceId" IS NOT NULL AND "categoryId" IS NULL AND "proposedName" IS NULL) OR
    ("type" = 'PROPOSE_NEW_SERVICE' AND "providerServiceId" IS NULL AND ("serviceId" IS NULL OR "status" = 'APPROVED') AND "categoryId" IS NOT NULL AND "proposedName" IS NOT NULL AND "normalizedName" IS NOT NULL)
  )
);

CREATE TABLE "provider_service_change_documents" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "type" "ProviderDocumentType" NOT NULL,
  "publicId" TEXT NOT NULL,
  "fileFormat" TEXT NOT NULL,
  "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_service_change_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_service_change_requests_providerId_status_createdAt_idx" ON "provider_service_change_requests"("providerId", "status", "createdAt");
CREATE INDEX "provider_service_change_requests_status_submittedAt_idx" ON "provider_service_change_requests"("status", "submittedAt");
CREATE INDEX "provider_service_change_requests_reviewedById_idx" ON "provider_service_change_requests"("reviewedById");
CREATE INDEX "provider_service_change_documents_requestId_type_idx" ON "provider_service_change_documents"("requestId", "type");
CREATE UNIQUE INDEX "provider_service_change_open_offering" ON "provider_service_change_requests"("providerServiceId") WHERE "status" IN ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES') AND "providerServiceId" IS NOT NULL;
CREATE UNIQUE INDEX "provider_service_change_open_service" ON "provider_service_change_requests"("providerId", "serviceId") WHERE "status" IN ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES') AND "serviceId" IS NOT NULL;
CREATE UNIQUE INDEX "provider_service_change_open_suggestion" ON "provider_service_change_requests"("providerId", "categoryId", "normalizedName") WHERE "status" IN ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES') AND "type" = 'PROPOSE_NEW_SERVICE';

ALTER TABLE "provider_service_change_requests" ADD CONSTRAINT "provider_service_change_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_service_change_requests" ADD CONSTRAINT "provider_service_change_requests_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_service_change_requests" ADD CONSTRAINT "provider_service_change_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_service_change_requests" ADD CONSTRAINT "provider_service_change_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_service_change_requests" ADD CONSTRAINT "provider_service_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_service_change_documents" ADD CONSTRAINT "provider_service_change_documents_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "provider_service_change_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
