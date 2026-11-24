CREATE TABLE "internal_setup_tokens" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "internal_setup_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "internal_setup_tokens_tokenHash_key" ON "internal_setup_tokens"("tokenHash");
CREATE INDEX "internal_setup_tokens_accountId_consumedAt_idx" ON "internal_setup_tokens"("accountId", "consumedAt");
CREATE INDEX "internal_setup_tokens_expiresAt_idx" ON "internal_setup_tokens"("expiresAt");
ALTER TABLE "internal_setup_tokens" ADD CONSTRAINT "internal_setup_tokens_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "internal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
