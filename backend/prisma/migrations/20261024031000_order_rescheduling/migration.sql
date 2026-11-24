CREATE TYPE "OrderRescheduleStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "order_reschedule_requests" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "OrderRescheduleStatus" NOT NULL DEFAULT 'PENDING',
  "proposedStartAt" TIMESTAMP(3) NOT NULL,
  "proposedEndAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "order_reschedule_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_reschedule_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reschedule_positive_interval" CHECK ("proposedEndAt" > "proposedStartAt")
);

CREATE INDEX "order_reschedule_requests_orderId_createdAt_idx" ON "order_reschedule_requests"("orderId", "createdAt" DESC);
CREATE INDEX "order_reschedule_requests_status_expiresAt_idx" ON "order_reschedule_requests"("status", "expiresAt");
CREATE UNIQUE INDEX "order_reschedule_one_pending_per_order" ON "order_reschedule_requests"("orderId") WHERE "status" = 'PENDING';
