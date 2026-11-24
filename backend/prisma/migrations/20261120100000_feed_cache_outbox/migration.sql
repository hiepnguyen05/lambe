BEGIN;
CREATE TABLE feed_cache_state (id TEXT PRIMARY KEY, version BIGINT NOT NULL DEFAULT 1);
INSERT INTO feed_cache_state(id) VALUES ('global');
CREATE TABLE feed_cache_events (
  sequence BIGINT PRIMARY KEY,
  "eventType" VARCHAR(60) NOT NULL,
  "postId" TEXT,
  "providerId" TEXT,
  "revisionNumber" INTEGER,
  "oldCacheKey" TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX feed_cache_events_processed_available_idx ON feed_cache_events("processedAt", "availableAt", sequence);
CREATE INDEX feed_cache_events_processed_created_idx ON feed_cache_events("processedAt", "createdAt");

-- The generation and outbox change in the same transaction as every publication dependency.
-- The row lock serializes generations in commit order; rolled-back writes expose no event.
CREATE FUNCTION queue_feed_cache_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v BIGINT; p TEXT; provider_id TEXT; rev INTEGER; old_key TEXT; kind TEXT;
BEGIN
  UPDATE feed_cache_state SET version=version+1 WHERE id='global' RETURNING version INTO v;
  IF TG_TABLE_NAME='feed_posts' THEN
    IF TG_OP='DELETE' THEN p=OLD.id; provider_id=OLD."providerId"; rev=OLD."revisionNumber";
    ELSE p=NEW.id; provider_id=NEW."providerId"; rev=NEW."revisionNumber"; END IF;
    IF TG_OP<>'INSERT' THEN
      old_key='lambe:feed:v1:post:' || OLD.id || ':revision:' || OLD."revisionNumber" || ':updated:' || floor(extract(epoch FROM OLD."updatedAt")*1000)::bigint;
    END IF;
    kind=CASE WHEN TG_OP='DELETE' OR NEW.status::text='DELETED' THEN 'FEED_POST_DELETED'
      WHEN NEW.status::text='HIDDEN' THEN 'FEED_POST_HIDDEN'
      WHEN NEW."organizationReviewStatus"::text='REJECTED' THEN 'FEED_POST_REJECTED'
      WHEN TG_OP='INSERT' AND NEW."organizationReviewStatus"::text='PENDING' THEN 'FEED_POST_CREATED'
      WHEN TG_OP='INSERT' THEN 'FEED_POST_PUBLISHED'
      WHEN NEW."organizationReviewStatus"::text='APPROVED' AND OLD."organizationReviewStatus" IS DISTINCT FROM NEW."organizationReviewStatus" THEN 'FEED_POST_APPROVED'
      ELSE 'FEED_POST_UPDATED' END;
  ELSE
    kind=CASE WHEN TG_TABLE_NAME IN ('provider_profiles','users') THEN 'PROVIDER_FEED_VISIBILITY_CHANGED'
      ELSE 'SERVICE_FEED_VISIBILITY_CHANGED' END;
  END IF;
  INSERT INTO feed_cache_events(sequence,"eventType","postId","providerId","revisionNumber","oldCacheKey")
  VALUES(v,kind,p,provider_id,rev,old_key);
  RETURN NULL;
END $$;
CREATE TRIGGER feed_cache_post_change AFTER INSERT OR UPDATE OR DELETE ON feed_posts FOR EACH ROW EXECUTE FUNCTION queue_feed_cache_change();
CREATE TRIGGER feed_cache_post_services_change AFTER INSERT OR UPDATE OR DELETE ON feed_post_services FOR EACH STATEMENT EXECUTE FUNCTION queue_feed_cache_change();
CREATE TRIGGER feed_cache_provider_change AFTER UPDATE OF status,"displayName","avatarUrl" ON provider_profiles FOR EACH STATEMENT EXECUTE FUNCTION queue_feed_cache_change();
CREATE TRIGGER feed_cache_user_change AFTER UPDATE OF status ON users FOR EACH STATEMENT EXECUTE FUNCTION queue_feed_cache_change();
CREATE TRIGGER feed_cache_offering_change AFTER UPDATE OF status,"priceAmount","durationMinutes" ON provider_services FOR EACH STATEMENT EXECUTE FUNCTION queue_feed_cache_change();
CREATE TRIGGER feed_cache_service_change AFTER UPDATE OF status,name,"categoryId" ON services FOR EACH STATEMENT EXECUTE FUNCTION queue_feed_cache_change();
CREATE TRIGGER feed_cache_category_change AFTER UPDATE OF status ON service_categories FOR EACH STATEMENT EXECUTE FUNCTION queue_feed_cache_change();
COMMIT;
