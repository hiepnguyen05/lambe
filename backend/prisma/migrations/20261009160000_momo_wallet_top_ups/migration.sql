CREATE TYPE "WalletTopUpStatus" AS ENUM (
  'CREATED', 'PENDING_PAYMENT', 'SUCCEEDED', 'FAILED', 'EXPIRED'
);

CREATE TABLE "wallet_top_up_requests" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "WalletTopUpStatus" NOT NULL DEFAULT 'CREATED',
  "provider" TEXT NOT NULL DEFAULT 'MOMO',
  "orderId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "orderInfo" TEXT NOT NULL,
  "extraData" TEXT NOT NULL DEFAULT '',
  "payUrl" TEXT,
  "deeplink" TEXT,
  "qrCodeUrl" TEXT,
  "momoTransId" TEXT,
  "resultCode" INTEGER,
  "resultMessage" TEXT,
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_top_up_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_top_up_requests_amount_check" CHECK (
    "amount" >= 1000 AND "amount" <= 50000000
  )
);

CREATE UNIQUE INDEX "wallet_top_up_requests_orderId_key"
ON "wallet_top_up_requests"("orderId");
CREATE UNIQUE INDEX "wallet_top_up_requests_requestId_key"
ON "wallet_top_up_requests"("requestId");
CREATE UNIQUE INDEX "wallet_top_up_requests_momoTransId_key"
ON "wallet_top_up_requests"("momoTransId");
CREATE INDEX "wallet_top_up_requests_walletId_createdAt_idx"
ON "wallet_top_up_requests"("walletId", "createdAt");
CREATE INDEX "wallet_top_up_requests_status_expiresAt_idx"
ON "wallet_top_up_requests"("status", "expiresAt");

ALTER TABLE "wallet_top_up_requests"
ADD CONSTRAINT "wallet_top_up_requests_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "provider_wallets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
