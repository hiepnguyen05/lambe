CREATE TABLE "order_contact_attempts" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_contact_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_contact_attempts_orderId_attemptedAt_idx" ON "order_contact_attempts"("orderId", "attemptedAt");
ALTER TABLE "order_contact_attempts" ADD CONSTRAINT "order_contact_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
