CREATE TYPE "BookingType" AS ENUM ('ASAP', 'SCHEDULED');
CREATE TYPE "ServiceOrderStatus" AS ENUM (
  'PENDING_PROVIDER', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED',
  'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED',
  'PAYMENT_DISPUTE', 'DISPUTED'
);
CREATE TYPE "PaymentMethod" AS ENUM ('CASH');
CREATE TYPE "WalletHoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CAPTURED');
CREATE TYPE "WalletTransactionType" AS ENUM (
  'HOLD', 'RELEASE', 'COMMISSION', 'ADJUSTMENT', 'TOP_UP', 'REFUND'
);

CREATE TABLE "service_orders" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerServiceId" TEXT NOT NULL,
  "customerAddressId" TEXT,
  "bookingType" "BookingType" NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "status" "ServiceOrderStatus" NOT NULL DEFAULT 'PENDING_PROVIDER',
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "serviceName" TEXT NOT NULL,
  "servicePriceAmount" INTEGER NOT NULL,
  "travelFeeAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'VND',
  "durationMinutes" INTEGER NOT NULL,
  "commissionRateBps" INTEGER NOT NULL,
  "commissionAmount" INTEGER NOT NULL,
  "addressLabel" TEXT NOT NULL,
  "addressLine" TEXT NOT NULL,
  "addressProvinceName" TEXT,
  "addressDistrictName" TEXT,
  "addressWardName" TEXT,
  "addressStreetLine" TEXT,
  "addressLatitude" DOUBLE PRECISION NOT NULL,
  "addressLongitude" DOUBLE PRECISION NOT NULL,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "addressNote" TEXT,
  "customerNote" TEXT,
  "providerResponseDeadlineAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "enRouteAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fromStatus" "ServiceOrderStatus",
  "toStatus" "ServiceOrderStatus" NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_holds" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "WalletHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3),
  CONSTRAINT "wallet_holds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_transactions" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "orderId" TEXT,
  "type" "WalletTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceBeforeAmount" INTEGER NOT NULL,
  "balanceAfterAmount" INTEGER NOT NULL,
  "heldBeforeAmount" INTEGER NOT NULL,
  "heldAfterAmount" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_orders_customerId_createdAt_idx" ON "service_orders"("customerId", "createdAt");
CREATE INDEX "service_orders_providerId_status_scheduledAt_idx" ON "service_orders"("providerId", "status", "scheduledAt");
CREATE INDEX "service_orders_status_providerResponseDeadlineAt_idx" ON "service_orders"("status", "providerResponseDeadlineAt");
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");
CREATE UNIQUE INDEX "wallet_holds_orderId_key" ON "wallet_holds"("orderId");
CREATE INDEX "wallet_holds_walletId_status_idx" ON "wallet_holds"("walletId", "status");
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "wallet_transactions"("idempotencyKey");
CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");
CREATE INDEX "wallet_transactions_orderId_idx" ON "wallet_transactions"("orderId");

ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_providerServiceId_fkey"
FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customerAddressId_fkey"
FOREIGN KEY ("customerAddressId") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "provider_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "provider_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
