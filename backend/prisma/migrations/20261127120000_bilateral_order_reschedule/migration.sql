ALTER TYPE "OrderRescheduleStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "OrderRescheduleStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TABLE "order_reschedule_requests"
  ADD COLUMN "requestedByRole" VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "requestedByUserId" TEXT,
  ADD CONSTRAINT "order_reschedule_request_role_check" CHECK ("requestedByRole" IN ('CUSTOMER', 'PROVIDER'));
