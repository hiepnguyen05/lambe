CREATE TYPE "ServiceStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "coverImageUrl" TEXT,
    "coverImagePublicId" TEXT,
    "minPriceAmount" INTEGER NOT NULL,
    "maxPriceAmount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'VND',
    "defaultDurationMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "services_price_range_check" CHECK (
      "minPriceAmount" > 0
      AND "maxPriceAmount" > 0
      AND "minPriceAmount" <= "maxPriceAmount"
    ),
    CONSTRAINT "services_currency_code_check" CHECK ("currencyCode" = 'VND'),
    CONSTRAINT "services_default_duration_check" CHECK (
      "defaultDurationMinutes" IS NULL
      OR "defaultDurationMinutes" BETWEEN 15 AND 720
    )
);

CREATE UNIQUE INDEX "services_code_key" ON "services"("code");
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");
CREATE UNIQUE INDEX "services_categoryId_normalizedName_key" ON "services"("categoryId", "normalizedName");
CREATE INDEX "services_categoryId_status_sortOrder_idx" ON "services"("categoryId", "status", "sortOrder");
CREATE INDEX "services_status_sortOrder_idx" ON "services"("status", "sortOrder");
CREATE INDEX "services_createdById_idx" ON "services"("createdById");
CREATE INDEX "services_updatedById_idx" ON "services"("updatedById");

ALTER TABLE "services"
ADD CONSTRAINT "services_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "services"
ADD CONSTRAINT "services_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "internal_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "services"
ADD CONSTRAINT "services_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "internal_accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
