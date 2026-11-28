-- The catalog reset can remove the singleton used by the feed outbox trigger.
-- Resume above any existing event sequence so the next trigger cannot collide.
INSERT INTO feed_cache_state (id, version)
SELECT 'global', GREATEST(1, COALESCE(MAX(sequence), 1))
FROM feed_cache_events
ON CONFLICT (id) DO NOTHING;
