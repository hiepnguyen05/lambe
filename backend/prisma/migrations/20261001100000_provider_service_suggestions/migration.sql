CREATE TYPE "ProviderServiceSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "provider_service_suggestions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "proposedPriceAmount" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "status" "ProviderServiceSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "approvedServiceId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_service_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_service_suggestions_applicationId_categoryId_normalizedName_key" ON "provider_service_suggestions"("applicationId", "categoryId", "normalizedName");
CREATE INDEX "provider_service_suggestions_applicationId_status_idx" ON "provider_service_suggestions"("applicationId", "status");
CREATE INDEX "provider_service_suggestions_status_createdAt_idx" ON "provider_service_suggestions"("status", "createdAt");
CREATE INDEX "provider_service_suggestions_approvedServiceId_idx" ON "provider_service_suggestions"("approvedServiceId");
CREATE INDEX "provider_service_suggestions_reviewedById_idx" ON "provider_service_suggestions"("reviewedById");

ALTER TABLE "provider_service_suggestions" ADD CONSTRAINT "provider_service_suggestions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_service_suggestions" ADD CONSTRAINT "provider_service_suggestions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_service_suggestions" ADD CONSTRAINT "provider_service_suggestions_approvedServiceId_fkey" FOREIGN KEY ("approvedServiceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_service_suggestions" ADD CONSTRAINT "provider_service_suggestions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
