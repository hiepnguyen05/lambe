BEGIN;
ALTER TABLE "provider_profiles" ADD COLUMN "acceptingMemberOrders" BOOLEAN NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION "close_organization_member_sessions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" <> 'ACTIVE')
     OR (OLD."acceptingMemberOrders" AND NOT NEW."acceptingMemberOrders") THEN
    UPDATE "provider_member_availability_sessions" SET "endedAt" = CURRENT_TIMESTAMP,
      "endReason" = CASE WHEN NOT NEW."acceptingMemberOrders" THEN 'ORGANIZATION_PAUSED' ELSE 'PROVIDER_UNAVAILABLE' END
      WHERE "memberId" IN (SELECT "id" FROM "provider_members" WHERE "providerId" = NEW."id") AND "endedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
COMMIT;
