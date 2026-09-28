CREATE TYPE "ServiceTargetAudience" AS ENUM ('ALL', 'MEN', 'WOMEN');
CREATE TYPE "CustomerOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');
CREATE TYPE "CustomerPricePreference" AS ENUM ('NO_PREFERENCE', 'BUDGET', 'BALANCED', 'PREMIUM');

ALTER TABLE "services"
ADD COLUMN "targetAudience" "ServiceTargetAudience" NOT NULL DEFAULT 'ALL';

CREATE INDEX "services_targetAudience_status_sortOrder_idx"
ON "services"("targetAudience", "status", "sortOrder");

CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" "Gender",
    "preferredAudience" "ServiceTargetAudience" NOT NULL DEFAULT 'ALL',
    "pricePreference" "CustomerPricePreference" NOT NULL DEFAULT 'NO_PREFERENCE',
    "onboardingStatus" "CustomerOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_category_interests" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_category_interests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_service_interests" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_service_interests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_profiles_userId_key" ON "customer_profiles"("userId");
CREATE INDEX "customer_profiles_onboardingStatus_idx" ON "customer_profiles"("onboardingStatus");
CREATE UNIQUE INDEX "customer_category_interests_customerProfileId_categoryId_key"
ON "customer_category_interests"("customerProfileId", "categoryId");
CREATE INDEX "customer_category_interests_categoryId_idx" ON "customer_category_interests"("categoryId");
CREATE UNIQUE INDEX "customer_service_interests_customerProfileId_serviceId_key"
ON "customer_service_interests"("customerProfileId", "serviceId");
CREATE INDEX "customer_service_interests_serviceId_idx" ON "customer_service_interests"("serviceId");
CREATE INDEX "customer_addresses_userId_isDefault_idx" ON "customer_addresses"("userId", "isDefault");
CREATE UNIQUE INDEX "customer_addresses_one_default_per_user_idx"
ON "customer_addresses"("userId") WHERE "isDefault" = true;

ALTER TABLE "customer_profiles"
ADD CONSTRAINT "customer_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_category_interests"
ADD CONSTRAINT "customer_category_interests_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_category_interests"
ADD CONSTRAINT "customer_category_interests_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_service_interests"
ADD CONSTRAINT "customer_service_interests_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_service_interests"
ADD CONSTRAINT "customer_service_interests_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_addresses"
ADD CONSTRAINT "customer_addresses_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
