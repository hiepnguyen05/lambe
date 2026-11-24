BEGIN;
ALTER TABLE "service_orders" ADD COLUMN "cashCollectedAmount" INTEGER;
-- Only backfill explicit receipts. A support-confirmed payment does not identify a cash collector.
UPDATE "service_orders" SET "cashCollectedAmount" = "totalAmount"
WHERE "status" = 'COMPLETED' AND "cashCollectedAt" IS NOT NULL AND "cashCollectedByUserId" IS NOT NULL;
ALTER TABLE "service_orders" ADD CONSTRAINT "orders_cash_receipt_check" CHECK (
  "cashCollectedAmount" IS NULL OR (
    "cashCollectedAmount" >= 0 AND "cashCollectedAmount" = "totalAmount"
    AND "status" = 'COMPLETED' AND "cashCollectedAt" IS NOT NULL AND "cashCollectedByUserId" IS NOT NULL
  )
);
CREATE INDEX "orders_provider_completed_idx" ON "service_orders" ("providerId", "completedAt", "id");
CREATE INDEX "orders_member_completed_idx" ON "service_orders" ("assignedMemberId", "completedAt", "id");
CREATE FUNCTION "check_order_cash_receipt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD."cashCollectedAmount" IS NOT NULL OR OLD."cashCollectedAt" IS NOT NULL OR OLD."cashCollectedByUserId" IS NOT NULL)
    AND (NEW."cashCollectedAmount", NEW."cashCollectedAt", NEW."cashCollectedByUserId")
    IS DISTINCT FROM (OLD."cashCollectedAmount", OLD."cashCollectedAt", OLD."cashCollectedByUserId") THEN
    RAISE EXCEPTION 'Cash receipt is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."cashCollectedAmount" IS NOT NULL AND (TG_OP = 'INSERT' OR OLD."cashCollectedAmount" IS NULL) THEN
    IF NEW."cashCollectedByUserId" IS DISTINCT FROM COALESCE(NEW."assignedMemberUserId", (SELECT p."userId" FROM "provider_profiles" p WHERE p."id"=NEW."providerId")) THEN
      RAISE EXCEPTION 'Cash collector must be the serving user' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "order_cash_receipt_check" BEFORE INSERT OR UPDATE ON "service_orders"
FOR EACH ROW EXECUTE FUNCTION "check_order_cash_receipt"();
COMMIT;
