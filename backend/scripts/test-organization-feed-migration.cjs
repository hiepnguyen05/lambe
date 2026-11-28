const {
  readMigration,
  runRehearsal,
  temporarySchema,
} = require('./migration-rehearsal.cjs');
const schema = temporarySchema('feed_rehearsal');
const migration = readMigration(
  '../prisma/migrations/20261029120000_organization_member_feed/migration.sql',
  true,
);
const sql = `
BEGIN;
CREATE SCHEMA "${schema}";
SET search_path TO "${schema}",public;
CREATE TYPE "ProviderMemberRole" AS ENUM('OWNER','WORKER');
CREATE TABLE provider_profiles(id TEXT PRIMARY KEY,"userId" TEXT,"providerType" TEXT);
INSERT INTO provider_profiles VALUES('org','owner','ORGANIZATION'),('other','other-owner','ORGANIZATION'),('individual','person','INDIVIDUAL');
CREATE TABLE provider_members(id TEXT PRIMARY KEY,"providerId" TEXT,"membershipVersion" INTEGER,role "ProviderMemberRole",status TEXT);
INSERT INTO provider_members VALUES('worker','org',1,'WORKER','ACTIVE'),('foreign','other',1,'WORKER','ACTIVE');
CREATE TABLE feed_posts(id TEXT PRIMARY KEY,"providerId" TEXT,caption TEXT,status TEXT,"createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
INSERT INTO feed_posts VALUES('legacy-org','org','KEEP LEGACY','PUBLISHED',CURRENT_TIMESTAMP),('legacy-individual','individual','KEEP INDIVIDUAL','PUBLISHED',CURRENT_TIMESTAMP),('hidden','org','KEEP HIDDEN','HIDDEN',CURRENT_TIMESTAMP);
${migration}
INSERT INTO feed_posts(id,"providerId",caption,status,"authorMemberId","authorMembershipVersion","authorRole","authorDisplayName","organizationReviewStatus")
VALUES('pending','org','Worker content','PUBLISHED','worker',1,'WORKER','Snapshot worker','PENDING');
DO $verify$
BEGIN
 IF (SELECT count(*) FROM feed_posts WHERE "authorMemberId" IS NULL AND "organizationReviewStatus" IS NULL)<>3
   OR NOT EXISTS(SELECT 1 FROM feed_posts WHERE id='legacy-org' AND caption='KEEP LEGACY' AND status='PUBLISHED')
   OR NOT EXISTS(SELECT 1 FROM feed_posts WHERE id='hidden' AND status='HIDDEN') THEN RAISE EXCEPTION 'Legacy content or visibility changed'; END IF;
 BEGIN
   INSERT INTO feed_posts(id,"providerId",caption,status,"authorMemberId","authorMembershipVersion","authorRole","authorDisplayName","organizationReviewStatus")
   VALUES('forged','org','Wrong author','PUBLISHED','foreign',1,'WORKER','Fake','PENDING');
   RAISE EXCEPTION 'Foreign author accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   UPDATE feed_posts SET "authorDisplayName"='Forged' WHERE id='pending';
   RAISE EXCEPTION 'Snapshot mutable';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   UPDATE feed_posts SET caption='Unversioned edit' WHERE id='pending';
   RAISE EXCEPTION 'Revision guard failed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   UPDATE feed_posts SET "organizationReviewStatus"='APPROVED',"organizationReviewedAt"=CURRENT_TIMESTAMP,"organizationReviewedByUserId"='other-owner' WHERE id='pending';
   RAISE EXCEPTION 'Foreign reviewer accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE feed_posts SET "organizationReviewStatus"='APPROVED',"organizationReviewedAt"=CURRENT_TIMESTAMP,"organizationReviewedByUserId"='owner' WHERE id='pending';
 BEGIN
   UPDATE feed_posts SET caption='Unreviewed content',"revisionNumber"=2 WHERE id='pending';
   RAISE EXCEPTION 'Approved worker edit accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE feed_posts SET caption='Pending new revision',"revisionNumber"=2,"organizationReviewStatus"='PENDING',"organizationReviewedAt"=NULL,"organizationReviewedByUserId"=NULL WHERE id='pending';
 IF EXISTS(SELECT 1 FROM feed_posts WHERE id='pending' AND status='PUBLISHED' AND ("organizationReviewStatus" IS NULL OR "organizationReviewStatus"='APPROVED')) THEN RAISE EXCEPTION 'Pending post became public'; END IF;
END $verify$;
ROLLBACK;
`;
runRehearsal(
  sql,
  'PASS: legacy feed retained, author/owner/revision guards, worker edit resubmission and pending visibility. Private schema rolled back.',
);
