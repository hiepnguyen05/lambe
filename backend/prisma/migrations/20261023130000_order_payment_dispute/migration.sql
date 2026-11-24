ALTER TABLE "service_orders"
  ADD COLUMN "paymentDisputeReason" TEXT,
  ADD COLUMN "paymentDisputeOpenedAt" TIMESTAMP(3),
  ADD COLUMN "paymentDisputeDecidedAt" TIMESTAMP(3),
  ADD COLUMN "paymentDisputeDecisionNote" TEXT;
