CREATE TYPE "OrderOperationalAlertType" AS ENUM (
  'ACCEPTED_START_OVERDUE',
  'EN_ROUTE_OVERDUE',
  'ARRIVAL_START_OVERDUE',
  'SERVICE_COMPLETION_OVERDUE',
  'SAFETY_HOLD_STALE',
  'PAYMENT_DISPUTE_STALE',
  'DISPUTED_STALE',
  'CANCELLATION_REVIEW_STALE'
);

CREATE TYPE "OrderOperationalAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "order_operational_alerts" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "OrderOperationalAlertType" NOT NULL,
  "status" "OrderOperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolutionNote" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_operational_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_operational_alerts_status_detectedAt_idx"
  ON "order_operational_alerts"("status", "detectedAt");
CREATE INDEX "order_operational_alerts_orderId_detectedAt_idx"
  ON "order_operational_alerts"("orderId", "detectedAt");
CREATE UNIQUE INDEX "order_operational_alerts_active_unique"
  ON "order_operational_alerts"("orderId", "type")
  WHERE "status" IN ('OPEN', 'ACKNOWLEDGED');

ALTER TABLE "order_operational_alerts"
  ADD CONSTRAINT "order_operational_alerts_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_operational_alerts"
  ADD CONSTRAINT "order_operational_alerts_acknowledgedById_fkey"
  FOREIGN KEY ("acknowledgedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_operational_alerts"
  ADD CONSTRAINT "order_operational_alerts_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "internal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
