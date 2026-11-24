// A private schema and one rollback transaction keep every application row untouched.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const database = new URL(
  process.env.TEST_DATABASE_URL || 'postgresql://localhost/',
).pathname.slice(1);
if (!/^lambe_booking_test_[a-z0-9_]+$/.test(database))
  throw new Error('An isolated lambe_booking_test_* database is required.');
const schema = `reviews_rehearsal_${randomUUID().replaceAll('-', '')}`;
const migration = readFileSync(
  join(
    __dirname,
    '../prisma/migrations/20261029110000_order_member_reviews/migration.sql',
  ),
  'utf8',
)
  .replace(/^BEGIN;\s*/, '')
  .replace(/COMMIT;\s*$/, '');
const sql = `
BEGIN;
CREATE SCHEMA "${schema}";
SET search_path TO "${schema}",public;
CREATE TABLE provider_members (id TEXT PRIMARY KEY);
INSERT INTO provider_members VALUES ('worker-a'),('worker-b');
CREATE TABLE service_orders (id TEXT PRIMARY KEY,"customerId" TEXT NOT NULL,"providerId" TEXT NOT NULL,
  status TEXT NOT NULL,"assignedMemberId" TEXT,"assignedMemberVersion" INTEGER,
  "assignedMemberName" TEXT,"assignedMemberAvatarUrl" TEXT);
INSERT INTO service_orders VALUES
  ('assigned','customer','organization','COMPLETED','worker-a',1,'Original name','original-avatar'),
  ('legacy','customer','organization','COMPLETED',NULL,NULL,NULL,NULL),
  ('pending','customer','organization','IN_PROGRESS',NULL,NULL,NULL,NULL);
CREATE TABLE order_reviews (id TEXT PRIMARY KEY,"orderId" TEXT NOT NULL UNIQUE REFERENCES service_orders(id),
  "customerId" TEXT NOT NULL,"providerId" TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "order_reviews_providerId_createdAt_idx" ON order_reviews("providerId","createdAt");
INSERT INTO order_reviews (id,"orderId","customerId","providerId",rating,comment) VALUES
  ('assigned-review','assigned','customer','organization',4,'KEEP THIS CONTENT'),
  ('legacy-review','legacy','customer','organization',5,'KEEP LEGACY');
${migration}
DO $verify$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM order_reviews WHERE id='assigned-review' AND "memberId"='worker-a'
    AND "membershipVersion"=1 AND "memberDisplayName"='Original name' AND "memberAvatarUrl"='original-avatar'
    AND rating=4 AND comment='KEEP THIS CONTENT') THEN RAISE EXCEPTION 'Assigned backfill/content mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM order_reviews WHERE id='legacy-review' AND "memberId" IS NULL AND rating=5 AND comment='KEEP LEGACY')
    OR (SELECT count(*) FROM order_reviews)<>2 THEN RAISE EXCEPTION 'Legacy review changed or duplicated'; END IF;
  BEGIN
    UPDATE order_reviews SET "memberId"='worker-b' WHERE id='assigned-review';
    RAISE EXCEPTION 'Review attribution was mutable';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO order_reviews (id,"orderId","customerId","providerId",rating)
      VALUES ('invalid','pending','customer','organization',5);
    RAISE EXCEPTION 'Uncompleted order accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO order_reviews (id,"orderId","customerId","providerId",rating,"memberId","membershipVersion","memberDisplayName","memberAvatarUrl")
      VALUES ('wrong','assigned','attacker','organization',5,'worker-a',1,'Original name','original-avatar');
    RAISE EXCEPTION 'Wrong customer accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO order_reviews (id,"orderId","customerId","providerId",rating,"memberId","membershipVersion","memberDisplayName","memberAvatarUrl")
      VALUES ('duplicate','assigned','customer','organization',5,'worker-a',1,'Original name','original-avatar');
    RAISE EXCEPTION 'Duplicate order review accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    DELETE FROM provider_members WHERE id='worker-a';
    RAISE EXCEPTION 'Reviewed member deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $verify$;
ROLLBACK;
`;
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'lambe-postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
  ],
  { input: sql, encoding: 'utf8' },
);
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}
console.log(
  'PASS: exact assignment backfill, legacy/content preserved, no duplicate reviews, immutable attribution, completed-order guard and member retention. Rolled back private schema.',
);
