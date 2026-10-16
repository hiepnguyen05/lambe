CREATE INDEX "service_orders_customerId_status_providerResponseDeadlineAt_idx"
  ON "service_orders"("customerId", "status", "providerResponseDeadlineAt");
