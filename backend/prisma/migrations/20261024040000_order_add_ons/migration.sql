CREATE TYPE "OrderAddOnStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "order_add_ons" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "providerServiceId" TEXT NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "priceAmount" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "commissionAmount" INTEGER NOT NULL,
  "proposedTotalAmount" INTEGER NOT NULL,
  "proposedEndAt" TIMESTAMP(3) NOT NULL,
  "confirmedEndAt" TIMESTAMP(3),
  "note" TEXT,
  "status" "OrderAddOnStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "order_add_ons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_add_ons_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_add_ons_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_add_ons_positive_amounts" CHECK ("priceAmount" > 0 AND "durationMinutes" > 0 AND "commissionAmount" >= 0 AND "proposedTotalAmount" > 0)
);

CREATE UNIQUE INDEX "order_add_ons_orderId_clientRequestId_key" ON "order_add_ons"("orderId", "clientRequestId");
CREATE UNIQUE INDEX "order_add_ons_one_pending_per_order" ON "order_add_ons"("orderId") WHERE "status" = 'PENDING';
CREATE INDEX "order_add_ons_orderId_createdAt_idx" ON "order_add_ons"("orderId", "createdAt" DESC);
CREATE INDEX "order_add_ons_status_expiresAt_idx" ON "order_add_ons"("status", "expiresAt");
