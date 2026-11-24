BEGIN;
ALTER TABLE "provider_members"
  ADD COLUMN "availabilityVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "receivingRadiusKm" INTEGER,
  ADD CONSTRAINT "provider_members_radius_check" CHECK ("receivingRadiusKm" BETWEEN 1 AND 50),
  ADD CONSTRAINT "provider_members_availability_version_check" CHECK ("availabilityVersion" >= 0);

CREATE TABLE "provider_member_services" (
  "id" TEXT PRIMARY KEY, "memberId" TEXT NOT NULL, "membershipVersion" INTEGER NOT NULL,
  "providerServiceId" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_member_services_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT,
  CONSTRAINT "provider_member_services_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE RESTRICT,
  CONSTRAINT "provider_member_services_version_check" CHECK ("membershipVersion" > 0)
);
CREATE UNIQUE INDEX "provider_member_services_assignment_key" ON "provider_member_services" ("memberId", "membershipVersion", "providerServiceId");
CREATE INDEX "provider_member_services_providerServiceId_enabled_idx" ON "provider_member_services" ("providerServiceId", "enabled");
CREATE FUNCTION "check_member_service_organization"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "provider_members" m JOIN "provider_services" s ON s."providerId" = m."providerId"
      WHERE m."id" = NEW."memberId" AND s."id" = NEW."providerServiceId") THEN
    RAISE EXCEPTION 'Member service must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "provider_member_service_organization_check" BEFORE INSERT OR UPDATE ON "provider_member_services"
  FOR EACH ROW EXECUTE FUNCTION "check_member_service_organization"();

CREATE TABLE "provider_member_working_hours" (
  "id" TEXT PRIMARY KEY, "memberId" TEXT NOT NULL, "membershipVersion" INTEGER NOT NULL,
  "dayOfWeek" INTEGER NOT NULL, "startMinute" INTEGER NOT NULL, "endMinute" INTEGER NOT NULL,
  CONSTRAINT "provider_member_working_hours_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT,
  CONSTRAINT "provider_member_working_hours_bounds_check" CHECK ("membershipVersion" > 0 AND "dayOfWeek" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440)
);
CREATE UNIQUE INDEX "provider_member_hours_start_key" ON "provider_member_working_hours" ("memberId", "membershipVersion", "dayOfWeek", "startMinute");
ALTER TABLE "provider_member_working_hours" ADD CONSTRAINT "provider_member_hours_no_overlap"
  EXCLUDE USING gist ("memberId" WITH =, "membershipVersion" WITH =, "dayOfWeek" WITH =, int4range("startMinute", "endMinute", '[)') WITH &&);

CREATE TABLE "provider_member_time_offs" (
  "id" TEXT PRIMARY KEY, "memberId" TEXT NOT NULL, "membershipVersion" INTEGER NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL, "reason" TEXT,
  "cancelledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_member_time_offs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT,
  CONSTRAINT "provider_member_time_offs_bounds_check" CHECK ("membershipVersion" > 0 AND "endAt" > "startAt" AND "endAt" <= "startAt" + interval '90 days')
);
CREATE INDEX "provider_member_time_offs_memberId_membershipVersion_startAt_endAt_idx" ON "provider_member_time_offs" ("memberId", "membershipVersion", "startAt", "endAt");
ALTER TABLE "provider_member_time_offs" ADD CONSTRAINT "provider_member_time_offs_no_overlap"
  EXCLUDE USING gist ("memberId" WITH =, "membershipVersion" WITH =, tsrange("startAt", "endAt", '[)') WITH &&) WHERE ("cancelledAt" IS NULL);

CREATE TABLE "provider_member_availability_sessions" (
  "id" TEXT PRIMARY KEY, "memberId" TEXT NOT NULL, "membershipVersion" INTEGER NOT NULL, "version" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCapturedAt" TIMESTAMP(3) NOT NULL, "endedAt" TIMESTAMP(3), "endReason" TEXT,
  CONSTRAINT "provider_member_availability_sessions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "provider_members"("id") ON DELETE RESTRICT,
  CONSTRAINT "provider_member_availability_sessions_version_check" CHECK ("membershipVersion" > 0 AND "version" > 0)
);
CREATE UNIQUE INDEX "provider_member_availability_sessions_memberId_version_key" ON "provider_member_availability_sessions" ("memberId", "version");
CREATE UNIQUE INDEX "provider_member_one_open_session" ON "provider_member_availability_sessions" ("memberId") WHERE "endedAt" IS NULL;
CREATE INDEX "provider_member_availability_sessions_memberId_endedAt_idx" ON "provider_member_availability_sessions" ("memberId", "endedAt");
CREATE INDEX "provider_member_availability_sessions_endedAt_lastHeartbeatAt_idx" ON "provider_member_availability_sessions" ("endedAt", "lastHeartbeatAt");

-- Stop serving without deleting KYC, calendar, orders or audit. Rejoining never reuses a session/settings.
CREATE FUNCTION "close_ineligible_member_sessions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" OR NEW."canProvideServices" IS DISTINCT FROM OLD."canProvideServices"
     OR NEW."membershipVersion" IS DISTINCT FROM OLD."membershipVersion" THEN
    NEW."availabilityVersion" := OLD."availabilityVersion" + 1;
    UPDATE "provider_member_availability_sessions" SET "endedAt" = CURRENT_TIMESTAMP, "endReason" = 'MEMBERSHIP_CHANGED'
      WHERE "memberId" = OLD."id" AND "endedAt" IS NULL;
    IF NEW."membershipVersion" IS DISTINCT FROM OLD."membershipVersion" THEN NEW."receivingRadiusKm" := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "provider_member_close_sessions" BEFORE UPDATE ON "provider_members" FOR EACH ROW EXECUTE FUNCTION "close_ineligible_member_sessions"();

CREATE FUNCTION "close_organization_member_sessions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" <> 'ACTIVE' THEN
    UPDATE "provider_member_availability_sessions" SET "endedAt" = CURRENT_TIMESTAMP, "endReason" = 'PROVIDER_UNAVAILABLE'
      WHERE "memberId" IN (SELECT "id" FROM "provider_members" WHERE "providerId" = NEW."id") AND "endedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "provider_close_member_sessions" AFTER UPDATE ON "provider_profiles" FOR EACH ROW EXECUTE FUNCTION "close_organization_member_sessions"();

CREATE FUNCTION "close_user_member_sessions"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" <> 'ACTIVE' THEN
    UPDATE "provider_member_availability_sessions" SET "endedAt" = CURRENT_TIMESTAMP, "endReason" = 'USER_UNAVAILABLE'
      WHERE "memberId" IN (SELECT m."id" FROM "provider_members" m JOIN "provider_profiles" p ON p."id" = m."providerId"
        WHERE m."userId" = NEW."id" OR p."userId" = NEW."id") AND "endedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "user_close_member_sessions" AFTER UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "close_user_member_sessions"();
COMMIT;
