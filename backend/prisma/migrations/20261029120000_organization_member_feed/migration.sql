BEGIN;
CREATE TYPE "FeedOrganizationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE feed_posts
  ADD COLUMN "authorMemberId" TEXT,
  ADD COLUMN "authorMembershipVersion" INTEGER,
  ADD COLUMN "authorRole" "ProviderMemberRole",
  ADD COLUMN "authorDisplayName" TEXT,
  ADD COLUMN "authorAvatarUrl" TEXT,
  ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "organizationReviewStatus" "FeedOrganizationReviewStatus",
  ADD COLUMN "organizationReviewedByUserId" TEXT,
  ADD COLUMN "organizationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "organizationReviewNote" VARCHAR(500);
-- Existing posts keep their original visibility and unknown authorship. Never infer a worker.
ALTER TABLE feed_posts ADD CONSTRAINT feed_author_member_fkey FOREIGN KEY ("authorMemberId")
  REFERENCES provider_members(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE feed_posts ADD CONSTRAINT feed_author_snapshot_check CHECK (
  ("authorMemberId" IS NULL AND "authorMembershipVersion" IS NULL AND "authorRole" IS NULL AND "authorDisplayName" IS NULL AND "authorAvatarUrl" IS NULL)
  OR ("authorMemberId" IS NOT NULL AND "authorMembershipVersion" IS NOT NULL AND "authorMembershipVersion">0
    AND "authorRole" IS NOT NULL AND "authorDisplayName" IS NOT NULL AND "organizationReviewStatus" IS NOT NULL)
);
ALTER TABLE feed_posts ADD CONSTRAINT feed_organization_review_check CHECK (
  "revisionNumber">0 AND (
    (("organizationReviewStatus" IS NULL OR "organizationReviewStatus"='PENDING')
      AND "organizationReviewedByUserId" IS NULL AND "organizationReviewedAt" IS NULL AND "organizationReviewNote" IS NULL)
    OR ("organizationReviewStatus" IN ('APPROVED','REJECTED')
      AND "organizationReviewedByUserId" IS NOT NULL AND "organizationReviewedAt" IS NOT NULL
      AND ("organizationReviewStatus"<>'REJECTED' OR ("organizationReviewNote" IS NOT NULL AND length(trim("organizationReviewNote"))>=5)))
  )
);
CREATE INDEX feed_author_version_created_idx ON feed_posts("authorMemberId","authorMembershipVersion","createdAt",id);
CREATE INDEX feed_organization_review_created_idx ON feed_posts("providerId","organizationReviewStatus","createdAt",id);

CREATE FUNCTION enforce_feed_authorship() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p provider_profiles%ROWTYPE; m provider_members%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW."providerId",NEW."authorMemberId",NEW."authorMembershipVersion",NEW."authorRole",NEW."authorDisplayName",NEW."authorAvatarUrl")
      IS DISTINCT FROM ROW(OLD."providerId",OLD."authorMemberId",OLD."authorMembershipVersion",OLD."authorRole",OLD."authorDisplayName",OLD."authorAvatarUrl") THEN
      RAISE EXCEPTION 'Feed authorship is immutable' USING ERRCODE='23514';
    END IF;
    IF NEW."revisionNumber"<OLD."revisionNumber" OR NEW."revisionNumber">OLD."revisionNumber"+1 THEN
      RAISE EXCEPTION 'Invalid feed revision' USING ERRCODE='23514';
    END IF;
    IF ROW(NEW.caption) IS DISTINCT FROM ROW(OLD.caption) AND NEW."revisionNumber"<>OLD."revisionNumber"+1 THEN
      RAISE EXCEPTION 'Feed edits require a new revision' USING ERRCODE='23514';
    END IF;
    IF NEW."authorRole"='WORKER' AND NEW."revisionNumber"<>OLD."revisionNumber" AND NEW."organizationReviewStatus"<>'PENDING' THEN
      RAISE EXCEPTION 'Worker edits require organization review' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='INSERT' OR ROW(NEW."organizationReviewStatus",NEW."organizationReviewedByUserId")
    IS DISTINCT FROM ROW(OLD."organizationReviewStatus",OLD."organizationReviewedByUserId") THEN
    SELECT * INTO p FROM provider_profiles WHERE id=NEW."providerId";
    IF (p."providerType"::text<>'ORGANIZATION' AND NEW."organizationReviewStatus" IS NOT NULL)
      OR (NEW."organizationReviewedByUserId" IS NOT NULL AND NEW."organizationReviewedByUserId"<>p."userId") THEN
      RAISE EXCEPTION 'Organization review requires its owner' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='INSERT' AND p."providerType"::text='ORGANIZATION' THEN
    SELECT * INTO m FROM provider_members WHERE id=NEW."authorMemberId";
    IF NOT FOUND OR m."providerId"<>NEW."providerId" OR m."membershipVersion"<>NEW."authorMembershipVersion"
      OR m.role<>NEW."authorRole" OR m.status::text<>'ACTIVE' THEN
      RAISE EXCEPTION 'Feed author must match current organization membership' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER feed_authorship_guard BEFORE INSERT OR UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_feed_authorship();
COMMIT;
