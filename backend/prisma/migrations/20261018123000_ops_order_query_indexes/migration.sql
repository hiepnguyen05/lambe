CREATE INDEX "service_orders_createdAt_idx" ON "service_orders"("createdAt" DESC);
CREATE INDEX "service_orders_status_createdAt_idx" ON "service_orders"("status", "createdAt" DESC);
