ALTER TABLE "audit_logs" ADD COLUMN "requestId" TEXT;

CREATE INDEX "audit_logs_requestId_idx" ON "audit_logs"("requestId");
