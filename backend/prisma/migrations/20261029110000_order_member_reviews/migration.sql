BEGIN;
-- Attribute reviews from the immutable order, never from today's organization roster.
ALTER TABLE "order_reviews"
  ADD COLUMN "memberId" TEXT,
  ADD COLUMN "membershipVersion" INTEGER,
  ADD COLUMN "memberDisplayName" TEXT,
  ADD COLUMN "memberAvatarUrl" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "order_reviews" r JOIN "service_orders" o ON o.id = r."orderId"
    WHERE r."customerId" <> o."customerId" OR r."providerId" <> o."providerId"
      OR o.status::text <> 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'Review/order attribution or completion mismatch; investigate before migrating';
  END IF;
END $$;

UPDATE "order_reviews" r
SET "memberId" = o."assignedMemberId",
    "membershipVersion" = o."assignedMemberVersion",
    "memberDisplayName" = o."assignedMemberName",
    "memberAvatarUrl" = o."assignedMemberAvatarUrl"
FROM "service_orders" o
WHERE o.id = r."orderId" AND o."assignedMemberId" IS NOT NULL;

ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_member_snapshot_check" CHECK (
  ("memberId" IS NULL AND "membershipVersion" IS NULL AND "memberDisplayName" IS NULL AND "memberAvatarUrl" IS NULL)
  OR ("memberId" IS NOT NULL AND "membershipVersion" IS NOT NULL AND "membershipVersion" > 0 AND "memberDisplayName" IS NOT NULL)
);
CREATE INDEX "order_reviews_memberId_createdAt_id_idx" ON "order_reviews"("memberId", "createdAt", "id");
DROP INDEX "order_reviews_providerId_createdAt_idx";
CREATE INDEX "order_reviews_providerId_createdAt_id_idx" ON "order_reviews"("providerId", "createdAt", "id");

CREATE FUNCTION enforce_order_review_attribution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o "service_orders"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(NEW."orderId", NEW."customerId", NEW."providerId",
    NEW."memberId", NEW."membershipVersion", NEW."memberDisplayName", NEW."memberAvatarUrl")
    IS DISTINCT FROM ROW(OLD."orderId", OLD."customerId", OLD."providerId",
    OLD."memberId", OLD."membershipVersion", OLD."memberDisplayName", OLD."memberAvatarUrl") THEN
    RAISE EXCEPTION 'Review attribution is immutable' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO o FROM "service_orders" WHERE id = NEW."orderId" FOR SHARE;
  IF NOT FOUND OR o.status::text <> 'COMPLETED'
    OR ROW(NEW."customerId", NEW."providerId", NEW."memberId", NEW."membershipVersion", NEW."memberDisplayName", NEW."memberAvatarUrl")
    IS DISTINCT FROM ROW(o."customerId", o."providerId", o."assignedMemberId", o."assignedMemberVersion", o."assignedMemberName", o."assignedMemberAvatarUrl") THEN
    RAISE EXCEPTION 'Review must match its completed order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "order_review_attribution_guard" BEFORE INSERT OR UPDATE ON "order_reviews"
  FOR EACH ROW EXECUTE FUNCTION enforce_order_review_attribution();
COMMIT;
