ALTER TABLE "wallet_top_up_requests"
ADD COLUMN "sepayTransId" TEXT,
ADD COLUMN "checkoutData" JSONB;

CREATE UNIQUE INDEX "wallet_top_up_requests_sepayTransId_key"
ON "wallet_top_up_requests"("sepayTransId");
