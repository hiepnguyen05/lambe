CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'PROVIDER');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "ProviderType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');
CREATE TYPE "ProviderApplicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ProviderApplicationSection" AS ENUM ('IDENTITY', 'PORTRAIT', 'EXPERTISE', 'SERVICES', 'TERMS');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_CHANGES', 'REJECTED');
CREATE TYPE "ProviderDocumentType" AS ENUM ('PORTRAIT', 'ID_CARD_FRONT', 'ID_CARD_BACK', 'IDENTITY_SELFIE', 'PROFESSIONAL_CERTIFICATE', 'BUSINESS_LICENSE', 'PORTFOLIO', 'OTHER');
CREATE TYPE "ProviderProfileStatus" AS ENUM ('SETUP_REQUIRED', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "ProviderServiceStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED');

ALTER TABLE "users" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
UPDATE "users" SET "phoneVerifiedAt" = "createdAt" WHERE "phoneVerifiedAt" IS NULL;
ALTER TABLE "users" ALTER COLUMN "phoneVerifiedAt" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "phoneVerifiedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "provider_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "status" "ProviderApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "legalFullName" TEXT,
    "birthDate" DATE,
    "gender" "Gender",
    "email" TEXT,
    "biography" TEXT,
    "nationalIdNumber" TEXT,
    "experienceYears" INTEGER,
    "organizationName" TEXT,
    "taxCode" TEXT,
    "businessRegistrationNumber" TEXT,
    "registeredAddress" TEXT,
    "representativeName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "decisionReason" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_applications_revision_check" CHECK ("revisionNumber" >= 0),
    CONSTRAINT "provider_applications_experience_check" CHECK ("experienceYears" IS NULL OR "experienceYears" BETWEEN 0 AND 80)
);

CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "sourceApplicationId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

INSERT INTO "user_role_assignments" ("id", "userId", "role", "assignedAt")
SELECT "id" || ':CUSTOMER', "id", 'CUSTOMER'::"UserRole", CURRENT_TIMESTAMP FROM "users";

CREATE TABLE "provider_application_revisions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_application_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_application_checks" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "section" "ProviderApplicationSection" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_application_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_application_services" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "proposedPriceAmount" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "description" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_application_services_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_application_services_price_check" CHECK ("proposedPriceAmount" > 0),
    CONSTRAINT "provider_application_services_duration_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 15 AND 720)
);

CREATE TABLE "provider_application_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationServiceId" TEXT,
    "type" "ProviderDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "isPublicCandidate" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_application_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_application_terms_acceptances" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "provider_application_terms_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceApplicationId" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "biography" TEXT,
    "experienceYears" INTEGER,
    "status" "ProviderProfileStatus" NOT NULL DEFAULT 'SETUP_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_wallets" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "balanceAmount" INTEGER NOT NULL DEFAULT 0,
    "heldAmount" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'VND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_wallets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_wallets_amount_check" CHECK ("balanceAmount" >= 0 AND "heldAmount" >= 0 AND "heldAmount" <= "balanceAmount"),
    CONSTRAINT "provider_wallets_currency_check" CHECK ("currencyCode" = 'VND')
);

CREATE TABLE "provider_services" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "sourceApplicationId" TEXT NOT NULL,
    "priceAmount" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "description" TEXT,
    "status" "ProviderServiceStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_services_price_check" CHECK ("priceAmount" > 0),
    CONSTRAINT "provider_services_duration_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 15 AND 720)
);

CREATE UNIQUE INDEX "provider_applications_one_open_per_user" ON "provider_applications"("userId") WHERE "status" IN ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES');
CREATE INDEX "provider_applications_userId_status_idx" ON "provider_applications"("userId", "status");
CREATE INDEX "provider_applications_status_submittedAt_idx" ON "provider_applications"("status", "submittedAt");
CREATE INDEX "provider_applications_reviewedById_idx" ON "provider_applications"("reviewedById");
CREATE UNIQUE INDEX "user_role_assignments_userId_role_key" ON "user_role_assignments"("userId", "role");
CREATE INDEX "user_role_assignments_role_idx" ON "user_role_assignments"("role");
CREATE INDEX "user_role_assignments_sourceApplicationId_idx" ON "user_role_assignments"("sourceApplicationId");
CREATE UNIQUE INDEX "provider_application_revisions_applicationId_revisionNumber_key" ON "provider_application_revisions"("applicationId", "revisionNumber");
CREATE UNIQUE INDEX "provider_application_checks_applicationId_section_key" ON "provider_application_checks"("applicationId", "section");
CREATE INDEX "provider_application_checks_status_idx" ON "provider_application_checks"("status");
CREATE INDEX "provider_application_checks_reviewedById_idx" ON "provider_application_checks"("reviewedById");
CREATE UNIQUE INDEX "provider_application_services_applicationId_serviceId_key" ON "provider_application_services"("applicationId", "serviceId");
CREATE INDEX "provider_application_services_serviceId_status_idx" ON "provider_application_services"("serviceId", "status");
CREATE INDEX "provider_application_services_reviewedById_idx" ON "provider_application_services"("reviewedById");
CREATE INDEX "provider_application_documents_applicationId_type_idx" ON "provider_application_documents"("applicationId", "type");
CREATE INDEX "provider_application_documents_applicationServiceId_idx" ON "provider_application_documents"("applicationServiceId");
CREATE INDEX "provider_application_documents_reviewedById_idx" ON "provider_application_documents"("reviewedById");
CREATE UNIQUE INDEX "provider_application_terms_acceptances_applicationId_termsVersion_key" ON "provider_application_terms_acceptances"("applicationId", "termsVersion");
CREATE UNIQUE INDEX "provider_profiles_userId_key" ON "provider_profiles"("userId");
CREATE UNIQUE INDEX "provider_profiles_sourceApplicationId_key" ON "provider_profiles"("sourceApplicationId");
CREATE INDEX "provider_profiles_status_idx" ON "provider_profiles"("status");
CREATE UNIQUE INDEX "provider_wallets_providerId_key" ON "provider_wallets"("providerId");
CREATE UNIQUE INDEX "provider_services_providerId_serviceId_key" ON "provider_services"("providerId", "serviceId");
CREATE INDEX "provider_services_serviceId_status_idx" ON "provider_services"("serviceId", "status");
CREATE INDEX "provider_services_sourceApplicationId_idx" ON "provider_services"("sourceApplicationId");

ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_sourceApplicationId_fkey" FOREIGN KEY ("sourceApplicationId") REFERENCES "provider_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_application_revisions" ADD CONSTRAINT "provider_application_revisions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_application_checks" ADD CONSTRAINT "provider_application_checks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_application_checks" ADD CONSTRAINT "provider_application_checks_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_application_services" ADD CONSTRAINT "provider_application_services_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_application_services" ADD CONSTRAINT "provider_application_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_application_services" ADD CONSTRAINT "provider_application_services_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_application_documents" ADD CONSTRAINT "provider_application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_application_documents" ADD CONSTRAINT "provider_application_documents_applicationServiceId_fkey" FOREIGN KEY ("applicationServiceId") REFERENCES "provider_application_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_application_documents" ADD CONSTRAINT "provider_application_documents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_application_terms_acceptances" ADD CONSTRAINT "provider_application_terms_acceptances_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "provider_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_sourceApplicationId_fkey" FOREIGN KEY ("sourceApplicationId") REFERENCES "provider_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_wallets" ADD CONSTRAINT "provider_wallets_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_sourceApplicationId_fkey" FOREIGN KEY ("sourceApplicationId") REFERENCES "provider_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
