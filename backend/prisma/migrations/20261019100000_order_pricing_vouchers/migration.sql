CREATE TYPE "VoucherIssuer" AS ENUM ('PLATFORM', 'PROVIDER');
CREATE TYPE "VoucherDiscountType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "VoucherRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');
ALTER TYPE "WalletTransactionType" ADD VALUE 'VOUCHER_REIMBURSEMENT';

ALTER TABLE "service_orders"
  ADD COLUMN "travelDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "distanceSource" TEXT NOT NULL DEFAULT 'CONSERVATIVE_DISTANCE',
  ADD COLUMN "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "voucherCode" TEXT,
  ADD COLUMN "voucherIssuer" "VoucherIssuer",
  ADD COLUMN "platformFundedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerFundedAmount" INTEGER NOT NULL DEFAULT 0;
UPDATE "service_orders" SET "subtotalAmount" = "totalAmount";

CREATE TABLE "vouchers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "issuer" "VoucherIssuer" NOT NULL,
  "providerId" TEXT,
  "serviceId" TEXT,
  "discountType" "VoucherDiscountType" NOT NULL,
  "value" INTEGER NOT NULL,
  "maxDiscountAmount" INTEGER,
  "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "usageLimit" INTEGER NOT NULL,
  "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
  "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vouchers_provider_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vouchers_service_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "voucher_issuer_owner" CHECK (("issuer" = 'PLATFORM') OR ("issuer" = 'PROVIDER' AND "providerId" IS NOT NULL)),
  CONSTRAINT "voucher_valid_period" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "voucher_valid_limits" CHECK ("value" > 0 AND "usageLimit" > 0 AND "perCustomerLimit" > 0 AND "minOrderAmount" >= 0 AND ("maxDiscountAmount" IS NULL OR "maxDiscountAmount" > 0)),
  CONSTRAINT "voucher_percentage_cap" CHECK ("discountType" <> 'PERCENTAGE' OR ("value" <= 100 AND "maxDiscountAmount" IS NOT NULL)),
  CONSTRAINT "voucher_provider_percentage_cap" CHECK ("issuer" <> 'PROVIDER' OR "discountType" <> 'PERCENTAGE' OR "value" <= 30)
);
CREATE INDEX "vouchers_providerId_status_endsAt_idx" ON "vouchers"("providerId", "status", "endsAt");
CREATE INDEX "vouchers_status_startsAt_endsAt_idx" ON "vouchers"("status", "startsAt", "endsAt");

CREATE TABLE "voucher_redemptions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voucherId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL UNIQUE,
  "status" "VoucherRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voucher_redemptions_voucher_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "voucher_redemptions_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "voucher_redemptions_order_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "voucher_redemption_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "voucher_redemptions_voucherId_status_idx" ON "voucher_redemptions"("voucherId", "status");
CREATE INDEX "voucher_redemptions_voucherId_customerId_status_idx" ON "voucher_redemptions"("voucherId", "customerId", "status");
