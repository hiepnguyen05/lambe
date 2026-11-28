-- DropIndex
DROP INDEX "order_evidence_orderId_type_key";

-- CreateIndex
CREATE INDEX "order_evidence_orderId_type_idx" ON "order_evidence"("orderId", "type");
