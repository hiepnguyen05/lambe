-- CreateEnum
CREATE TYPE "ServiceCategoryStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "coverImageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceCategoryStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_categories_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,49}$'),
    CONSTRAINT "service_categories_name_length_check" CHECK (char_length(btrim("name")) BETWEEN 2 AND 100),
    CONSTRAINT "service_categories_normalized_name_check" CHECK (char_length(btrim("normalizedName")) BETWEEN 2 AND 100),
    CONSTRAINT "service_categories_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT "service_categories_description_length_check" CHECK ("description" IS NULL OR char_length("description") <= 500),
    CONSTRAINT "service_categories_icon_url_length_check" CHECK ("iconUrl" IS NULL OR char_length("iconUrl") <= 2048),
    CONSTRAINT "service_categories_cover_url_length_check" CHECK ("coverImageUrl" IS NULL OR char_length("coverImageUrl") <= 2048),
    CONSTRAINT "service_categories_sort_order_check" CHECK ("sortOrder" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_normalizedName_key" ON "service_categories"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_status_sortOrder_idx" ON "service_categories"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "service_categories_createdById_idx" ON "service_categories"("createdById");

-- CreateIndex
CREATE INDEX "service_categories_updatedById_idx" ON "service_categories"("updatedById");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
