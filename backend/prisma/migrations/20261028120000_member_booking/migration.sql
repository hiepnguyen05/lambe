BEGIN;
ALTER TABLE "service_orders"
  ADD COLUMN "assignedMemberId" TEXT,
  ADD COLUMN "assignedMemberVersion" INTEGER,
  ADD COLUMN "assignedMemberUserId" TEXT,
  ADD COLUMN "assignedMemberName" TEXT,
  ADD COLUMN "assignedMemberAvatarUrl" TEXT,
  ADD COLUMN "providerDisplayName" TEXT,
  ADD COLUMN "providerAvatarUrl" TEXT,
  ADD COLUMN "cashCollectedByUserId" TEXT,
  ADD COLUMN "cashCollectedAt" TIMESTAMP(3),
  ADD CONSTRAINT "service_orders_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "orders_member_snapshot_check" CHECK (
    ("assignedMemberId" IS NULL AND "assignedMemberVersion" IS NULL AND "assignedMemberUserId" IS NULL)
    OR ("assignedMemberId" IS NOT NULL AND "assignedMemberVersion" IS NOT NULL AND "assignedMemberVersion" > 0 AND "assignedMemberUserId" IS NOT NULL AND "assignedMemberName" IS NOT NULL)
  );
CREATE INDEX "orders_member_status_start_idx" ON "service_orders" ("assignedMemberId", "status", "expectedStartAt");
CREATE INDEX "orders_assignee_history_idx" ON "service_orders" ("assignedMemberUserId", "createdAt", "id");
ALTER TABLE "order_evidence" ADD COLUMN "uploadedByUserId" TEXT;
ALTER TABLE "order_cancellation_requests" ADD COLUMN "requestedByUserId" TEXT;
ALTER TABLE "provider_calendar_blocks" ADD COLUMN "memberId" TEXT,
  ADD CONSTRAINT "provider_calendar_blocks_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "calendar_member_active_start_idx" ON "provider_calendar_blocks" ("memberId", "active", "startAt");
-- Legacy commitments keep their provider-wide exclusivity; new worker bookings have independent capacity.
ALTER TABLE "provider_calendar_blocks" DROP CONSTRAINT "calendar_no_overlap";
ALTER TABLE "provider_calendar_blocks" ADD CONSTRAINT "calendar_no_overlap"
  EXCLUDE USING gist ("providerId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&) WHERE ("active" AND "memberId" IS NULL);
ALTER TABLE "provider_calendar_blocks" ADD CONSTRAINT "calendar_member_no_overlap"
  EXCLUDE USING gist ("memberId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&) WHERE ("active" AND "memberId" IS NOT NULL);

CREATE FUNCTION "check_order_member_assignment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."assignedMemberId", NEW."assignedMemberVersion", NEW."assignedMemberUserId", NEW."assignedMemberName", NEW."assignedMemberAvatarUrl", NEW."providerDisplayName", NEW."providerAvatarUrl")
    IS DISTINCT FROM (OLD."assignedMemberId", OLD."assignedMemberVersion", OLD."assignedMemberUserId", OLD."assignedMemberName", OLD."assignedMemberAvatarUrl", OLD."providerDisplayName", OLD."providerAvatarUrl") THEN
    RAISE EXCEPTION 'Order assignee and public snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."assignedMemberId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "provider_members" m WHERE m."id" = NEW."assignedMemberId" AND m."providerId" = NEW."providerId"
      AND m."userId" = NEW."assignedMemberUserId" AND m."membershipVersion" = NEW."assignedMemberVersion"
      AND m."status" = 'ACTIVE' AND m."canProvideServices"
  ) THEN RAISE EXCEPTION 'Invalid order member assignment' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "order_member_assignment_check" BEFORE INSERT OR UPDATE ON "service_orders" FOR EACH ROW EXECUTE FUNCTION "check_order_member_assignment"();
CREATE FUNCTION "check_calendar_member_assignment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."memberId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "provider_members" m WHERE m."id"=NEW."memberId" AND m."providerId"=NEW."providerId") THEN
    RAISE EXCEPTION 'Calendar member must belong to provider' USING ERRCODE='23514';
  END IF;
  IF NEW."orderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "service_orders" o WHERE o."id"=NEW."orderId" AND o."providerId"=NEW."providerId" AND o."assignedMemberId" IS NOT DISTINCT FROM NEW."memberId") THEN
    RAISE EXCEPTION 'Calendar assignee must match order' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "calendar_member_assignment_check" BEFORE INSERT OR UPDATE ON "provider_calendar_blocks" FOR EACH ROW EXECUTE FUNCTION "check_calendar_member_assignment"();
COMMIT;
