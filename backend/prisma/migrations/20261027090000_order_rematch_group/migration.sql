ALTER TABLE "service_orders"
  ADD COLUMN "bookingGroupId" TEXT,
  ADD COLUMN "bookingAttempt" INTEGER NOT NULL DEFAULT 1;

UPDATE "service_orders" SET "bookingGroupId" = "id";

ALTER TABLE "service_orders"
  ALTER COLUMN "bookingGroupId" SET NOT NULL,
  ALTER COLUMN "bookingGroupId" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX "service_orders_bookingGroupId_bookingAttempt_key"
  ON "service_orders"("bookingGroupId", "bookingAttempt");
CREATE INDEX "service_orders_bookingGroupId_status_idx"
  ON "service_orders"("bookingGroupId", "status");

-- A booking need can only have one unresolved/fulfilling attempt at a time.
CREATE UNIQUE INDEX "service_orders_one_active_attempt_per_group"
  ON "service_orders"("bookingGroupId")
  WHERE "status" IN (
    'PENDING_PROVIDER', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED',
    'IN_PROGRESS', 'SAFETY_HOLD', 'PAYMENT_DISPUTE', 'DISPUTED'
  );
