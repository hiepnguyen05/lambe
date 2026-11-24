ALTER TYPE "ServiceOrderStatus" ADD VALUE 'SAFETY_HOLD';

CREATE TYPE "OrderSafetyIncidentStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "OrderSafetyReason" AS ENUM ('THREAT', 'VIOLENCE', 'THEFT', 'MEDICAL', 'OTHER');

CREATE TABLE "order_safety_incidents" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderSafetyIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "resolutionNote" TEXT,
  CONSTRAINT "order_safety_incidents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_safety_incidents_orderId_key" ON "order_safety_incidents"("orderId");
CREATE INDEX "order_safety_incidents_status_createdAt_idx" ON "order_safety_incidents"("status", "createdAt");
ALTER TABLE "order_safety_incidents" ADD CONSTRAINT "order_safety_incidents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_safety_incidents" ADD CONSTRAINT "order_safety_incidents_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "internal_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_safety_reports" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "OrderSafetyReason" NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_safety_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_safety_reports_incidentId_reporterId_key" ON "order_safety_reports"("incidentId", "reporterId");
ALTER TABLE "order_safety_reports" ADD CONSTRAINT "order_safety_reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "order_safety_incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_safety_reports" ADD CONSTRAINT "order_safety_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_safety_evidence" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "fileFormat" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_safety_evidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_safety_evidence_publicId_key" ON "order_safety_evidence"("publicId");
CREATE INDEX "order_safety_evidence_incidentId_uploadedById_createdAt_idx" ON "order_safety_evidence"("incidentId", "uploadedById", "createdAt");
ALTER TABLE "order_safety_evidence" ADD CONSTRAINT "order_safety_evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "order_safety_incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_safety_evidence" ADD CONSTRAINT "order_safety_evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
