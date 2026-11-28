// Rehearse additive membership, verification and capabilities migrations on legacy rows.
// All fixtures live in a temporary schema inside an explicitly isolated test DB.
const {
  readMigration,
  runRehearsal,
  temporarySchema,
} = require('./migration-rehearsal.cjs');

const schema = temporarySchema('member_rehearsal');
const migration = readMigration(
  '../prisma/migrations/20261027130000_provider_members/migration.sql',
);
const verificationMigration = readMigration(
  '../prisma/migrations/20261027150000_provider_member_verification/migration.sql',
);
const capabilitiesMigration = readMigration(
  '../prisma/migrations/20261028100000_provider_member_capabilities/migration.sql',
);
const receivingMigration = readMigration(
  '../prisma/migrations/20261028103000_provider_member_receiving_control/migration.sql',
);
const bookingMigration = readMigration(
  '../prisma/migrations/20261028120000_member_booking/migration.sql',
);
const financeMigration = readMigration(
  '../prisma/migrations/20261029090000_member_finance/migration.sql',
);
const sql = `
CREATE SCHEMA "${schema}";
SET search_path TO "${schema}", public;
CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "fullName" TEXT, "avatarUrl" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE');
CREATE TABLE "provider_profiles" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
  "providerType" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);
INSERT INTO "users" ("id", "fullName", "avatarUrl") VALUES ('individual-user', 'Individual user', 'https://example.test/individual'), ('organization-user', 'Representative', NULL);
INSERT INTO "provider_profiles" ("id", "userId", "providerType", "displayName") VALUES
  ('individual', 'individual-user', 'INDIVIDUAL', 'Individual provider'),
  ('organization', 'organization-user', 'ORGANIZATION', 'Organization brand');
${migration}
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "ProviderDocumentType" AS ENUM ('PORTRAIT', 'ID_CARD_FRONT', 'ID_CARD_BACK', 'IDENTITY_SELFIE', 'PROFESSIONAL_CERTIFICATE', 'BUSINESS_LICENSE', 'PORTFOLIO', 'OTHER');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_CHANGES', 'REJECTED');
CREATE TABLE "provider_services" ("id" TEXT PRIMARY KEY, "providerId" TEXT NOT NULL);
${verificationMigration}
${capabilitiesMigration}
${receivingMigration}
DO $rehearsal$
BEGIN
  IF (SELECT count(*) FROM "provider_members") <> 2 THEN RAISE EXCEPTION 'Missing owner backfill'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "provider_members" WHERE "providerId"='individual' AND "role"='OWNER' AND "status"='ACTIVE' AND "canProvideServices" AND "displayName"='Individual provider') THEN RAISE EXCEPTION 'Invalid individual backfill'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "provider_members" WHERE "providerId"='organization' AND "role"='OWNER' AND "status"='ACTIVE' AND NOT "canProvideServices" AND "displayName"='Representative') THEN RAISE EXCEPTION 'Invalid organization backfill'; END IF;
  IF EXISTS (SELECT 1 FROM "provider_members" WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Invalid UUID format'; END IF;
  IF (SELECT count(*) FROM "provider_profiles") <> 2 OR (SELECT count(*) FROM "users") <> 2 THEN RAISE EXCEPTION 'Legacy rows changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "provider_profiles" WHERE "id"='organization' AND "userId"='organization-user' AND "displayName"='Organization brand') THEN RAISE EXCEPTION 'Legacy provider changed'; END IF;
  IF EXISTS (SELECT 1 FROM "provider_members" WHERE "membershipVersion" <> 1) THEN RAISE EXCEPTION 'Legacy membership version changed'; END IF;
  IF EXISTS (SELECT 1 FROM "provider_members" WHERE "availabilityVersion" <> 0 OR "receivingRadiusKm" IS NOT NULL) THEN RAISE EXCEPTION 'Legacy availability settings changed'; END IF;
  IF EXISTS (SELECT 1 FROM "provider_member_services") OR EXISTS (SELECT 1 FROM "provider_member_availability_sessions") THEN RAISE EXCEPTION 'Legacy members were automatically enabled'; END IF;
  INSERT INTO "provider_member_working_hours" ("id", "memberId", "membershipVersion", "dayOfWeek", "startMinute", "endMinute") SELECT 'valid-hours', "id", 1, 1, 480, 600 FROM "provider_members" WHERE "providerId"='organization';
  BEGIN
    INSERT INTO "provider_member_working_hours" ("id", "memberId", "membershipVersion", "dayOfWeek", "startMinute", "endMinute") SELECT 'overlap-hours', "id", 1, 1, 590, 650 FROM "provider_members" WHERE "providerId"='organization';
    RAISE EXCEPTION 'Overlapping hours were accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
  INSERT INTO "provider_services" VALUES ('other-org-service', 'individual');
  BEGIN
    INSERT INTO "provider_member_services" ("id", "memberId", "membershipVersion", "providerServiceId", "updatedAt") SELECT 'foreign-service', "id", 1, 'other-org-service', CURRENT_TIMESTAMP FROM "provider_members" WHERE "providerId"='organization';
    RAISE EXCEPTION 'Cross-organization service assignment was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO "provider_member_availability_sessions" ("id", "memberId", "membershipVersion", "version", "lastCapturedAt") SELECT 'legacy-session', "id", 1, 1, CURRENT_TIMESTAMP FROM "provider_members" WHERE "providerId"='organization';
  UPDATE "provider_profiles" SET "status"='SUSPENDED' WHERE "id"='organization';
  IF NOT EXISTS (SELECT 1 FROM "provider_member_availability_sessions" WHERE "id"='legacy-session' AND "endedAt" IS NOT NULL AND "endReason"='PROVIDER_UNAVAILABLE') THEN RAISE EXCEPTION 'Organization suspension did not end member session'; END IF;
  UPDATE "provider_profiles" SET "status"='ACTIVE' WHERE "id"='organization';
  INSERT INTO "provider_member_verifications" ("id", "memberId", "membershipVersion", "updatedAt")
  SELECT 'test-verification', "id", 1, CURRENT_TIMESTAMP FROM "provider_members" WHERE "providerId"='organization';
  BEGIN
    INSERT INTO "provider_member_documents" ("id", "verificationId", "type", "publicId", "fileFormat", "deliveryType")
    VALUES ('invalid-public-document', 'test-verification', 'ID_CARD_FRONT', 'test/public', 'png', 'upload');
    RAISE EXCEPTION 'Public verification document was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "provider_member_documents" ("id", "verificationId", "type", "publicId", "fileFormat", "deliveryType")
    VALUES ('invalid-svg-document', 'test-verification', 'ID_CARD_FRONT', 'test/svg', 'svg', 'authenticated');
    RAISE EXCEPTION 'SVG verification document was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$rehearsal$;
-- Representative legacy calendar/order shape, isolated from real application tables.
CREATE TABLE "service_orders" ("id" TEXT PRIMARY KEY, "providerId" TEXT NOT NULL, "status" TEXT NOT NULL, "totalAmount" INTEGER NOT NULL DEFAULT 150000, "completedAt" TIMESTAMP(3), "expectedStartAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "order_evidence" ("id" TEXT PRIMARY KEY);
CREATE TABLE "order_cancellation_requests" ("id" TEXT PRIMARY KEY);
CREATE TABLE "provider_calendar_blocks" (
  "id" TEXT PRIMARY KEY, "providerId" TEXT NOT NULL, "orderId" TEXT UNIQUE,
  "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  CHECK ("startAt" < "endAt")
);
ALTER TABLE "provider_calendar_blocks" ADD CONSTRAINT "calendar_no_overlap"
  EXCLUDE USING gist ("providerId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&) WHERE ("active");
INSERT INTO "service_orders" ("id", "providerId", "status") VALUES ('legacy-order', 'organization', 'ACCEPTED');
INSERT INTO "provider_calendar_blocks" ("id", "providerId", "orderId", "startAt", "endAt")
  VALUES ('legacy-calendar', 'organization', 'legacy-order', '2026-11-01 08:00:00', '2026-11-01 09:00:00');
${bookingMigration}
DO $booking_rehearsal$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "service_orders" WHERE "id"='legacy-order' AND "assignedMemberId" IS NULL AND "assignedMemberVersion" IS NULL AND "status"='ACCEPTED') THEN RAISE EXCEPTION 'Legacy order was reassigned or changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "provider_calendar_blocks" WHERE "id"='legacy-calendar' AND "memberId" IS NULL AND "active") THEN RAISE EXCEPTION 'Legacy calendar was changed'; END IF;
  INSERT INTO "users" ("id", "fullName") VALUES ('c-worker-a-user', 'Worker A'), ('c-worker-b-user', 'Worker B');
  INSERT INTO "provider_members" ("id", "providerId", "userId", "role", "status", "canProvideServices", "updatedAt")
    VALUES ('c-worker-a', 'organization', 'c-worker-a-user', 'WORKER', 'ACTIVE', true, CURRENT_TIMESTAMP),
           ('c-worker-b', 'organization', 'c-worker-b-user', 'WORKER', 'ACTIVE', true, CURRENT_TIMESTAMP);
  INSERT INTO "service_orders" ("id", "providerId", "status", "assignedMemberId", "assignedMemberVersion", "assignedMemberUserId", "assignedMemberName")
    VALUES ('c-order-a', 'organization', 'ACCEPTED', 'c-worker-a', 1, 'c-worker-a-user', 'Worker A'),
           ('c-order-b', 'organization', 'ACCEPTED', 'c-worker-b', 1, 'c-worker-b-user', 'Worker B');
  INSERT INTO "provider_calendar_blocks" ("id", "providerId", "orderId", "memberId", "startAt", "endAt")
    VALUES ('c-calendar-a', 'organization', 'c-order-a', 'c-worker-a', '2026-11-01 10:00:00', '2026-11-01 11:00:00'),
           ('c-calendar-b', 'organization', 'c-order-b', 'c-worker-b', '2026-11-01 10:00:00', '2026-11-01 11:00:00');
  BEGIN
    INSERT INTO "provider_calendar_blocks" ("id", "providerId", "memberId", "startAt", "endAt")
      VALUES ('c-overlap-a', 'organization', 'c-worker-a', '2026-11-01 10:30:00', '2026-11-01 11:30:00');
    RAISE EXCEPTION 'Same-worker overlap was accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
  BEGIN
    UPDATE "service_orders" SET "assignedMemberId"='c-worker-b' WHERE "id"='c-order-a';
    RAISE EXCEPTION 'Order reassignment was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "provider_calendar_blocks" ("id", "providerId", "orderId", "memberId", "startAt", "endAt")
      VALUES ('c-mismatched-calendar', 'organization', 'c-order-a', 'c-worker-b', '2026-11-01 12:00:00', '2026-11-01 13:00:00');
    RAISE EXCEPTION 'Mismatched calendar/order assignment was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $booking_rehearsal$;
INSERT INTO "service_orders" ("id","providerId","status","completedAt","cashCollectedAt","cashCollectedByUserId")
  VALUES ('d-old-receipt','organization','COMPLETED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'organization-user');
INSERT INTO "service_orders" ("id","providerId","status","completedAt")
  VALUES ('d-unverified-payment','organization','COMPLETED',CURRENT_TIMESTAMP);
${financeMigration}
DO $finance_rehearsal$
BEGIN
  IF (SELECT "cashCollectedAmount" FROM "service_orders" WHERE "id"='d-old-receipt') IS DISTINCT FROM 150000 THEN RAISE EXCEPTION 'Explicit receipt backfill failed'; END IF;
  IF EXISTS (SELECT 1 FROM "service_orders" WHERE "id"='d-unverified-payment' AND "cashCollectedAmount" IS NOT NULL) THEN RAISE EXCEPTION 'Unverified payment was fabricated'; END IF;
  UPDATE "service_orders" SET "status"='COMPLETED', "completedAt"=CURRENT_TIMESTAMP,
    "cashCollectedAmount"=150000,"cashCollectedAt"=CURRENT_TIMESTAMP,"cashCollectedByUserId"='c-worker-a-user' WHERE "id"='c-order-a';
  BEGIN
    UPDATE "service_orders" SET "cashCollectedByUserId"='organization-user' WHERE "id"='c-order-a';
    RAISE EXCEPTION 'Immutable collector could be changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE "service_orders" SET "status"='COMPLETED', "cashCollectedAmount"=150000,
      "cashCollectedAt"=CURRENT_TIMESTAMP,"cashCollectedByUserId"='organization-user' WHERE "id"='c-order-b';
    RAISE EXCEPTION 'Wrong worker cash receipt was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM "service_orders" WHERE "id"='legacy-order' AND "assignedMemberId" IS NULL AND "status"='ACCEPTED') THEN RAISE EXCEPTION 'Legacy active order changed during finance migration'; END IF;
END $finance_rehearsal$;
-- Keep additive history; image rollback also requires draining assigned jobs (see runbook).
-- This deletion only removes the temporary fixture schema in the isolated DB.
DROP SCHEMA "${schema}" CASCADE;
`;
runRehearsal(
  sql,
  'PASS: membership/KYC/capabilities/booking plus explicit cash backfill, unknown-payment preservation, immutable cash snapshots and correct collector validation.',
);
