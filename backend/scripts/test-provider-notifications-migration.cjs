const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const database = new URL(
  process.env.TEST_DATABASE_URL || 'postgresql://localhost/',
).pathname.slice(1);
if (!/^lambe_booking_test_[a-z0-9_]+$/.test(database))
  throw new Error('An isolated lambe_booking_test_* database is required.');
const schema = `ops_rehearsal_${randomUUID().replaceAll('-', '')}`;
const migration = readFileSync(
  join(
    __dirname,
    '../prisma/migrations/20261030090000_provider_operational_notifications/migration.sql',
  ),
  'utf8',
)
  .replace(/^BEGIN;\s*/, '')
  .replace(/COMMIT;\s*$/, '');
const sql = `
BEGIN;
CREATE SCHEMA "${schema}";
SET search_path TO "${schema}",public;
CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);
CREATE TABLE push_outbox(id TEXT PRIMARY KEY);
INSERT INTO users VALUES('owner','ACTIVE'),('worker','ACTIVE'),('other','ACTIVE');
CREATE TABLE provider_profiles(id TEXT PRIMARY KEY,"userId" TEXT,"providerType" TEXT,status TEXT,"setupCompletedAt" TIMESTAMP);
INSERT INTO provider_profiles VALUES('org','owner','ORGANIZATION','ACTIVE',CURRENT_TIMESTAMP);
CREATE TABLE provider_members(id TEXT PRIMARY KEY,"providerId" TEXT,"userId" TEXT,"membershipVersion" INTEGER,role TEXT,status TEXT);
INSERT INTO provider_members VALUES('member','org','worker',1,'WORKER','ACTIVE');
CREATE TABLE provider_wallets(id TEXT PRIMARY KEY,"providerId" TEXT,"balanceAmount" INTEGER,"heldAmount" INTEGER);
INSERT INTO provider_wallets VALUES('wallet','org',50000,0);
${migration}
DO $verify$
BEGIN
 IF (SELECT "balanceAmount" FROM provider_wallets WHERE id='wallet')<>50000 OR (SELECT count(*) FROM provider_operational_notifications)<>0
   OR (SELECT count(*) FROM provider_wallet_signals)<>1 THEN RAISE EXCEPTION 'Migration modified money or invented historical events'; END IF;
 UPDATE provider_wallets SET "balanceAmount"=1000 WHERE id='wallet';
 UPDATE provider_wallets SET "heldAmount"=100 WHERE id='wallet';
 IF (SELECT count(*) FROM provider_wallet_signals)<>1 OR (SELECT count(*) FROM provider_operational_notifications)<>0 THEN RAISE EXCEPTION 'Wallet signal did not coalesce'; END IF;
 UPDATE provider_members SET status='SUSPENDED' WHERE id='member';
 UPDATE provider_members SET status='SUSPENDED' WHERE id='member';
 IF (SELECT count(*) FROM provider_operational_notifications WHERE event='MEMBER_SUSPENDED' AND "userId"='owner' AND "memberId"='member' AND "membershipVersion"=1)<>1 THEN RAISE EXCEPTION 'Member recipient or duplicate event'; END IF;
 UPDATE provider_members SET status='ACTIVE' WHERE id='member';
 IF EXISTS(SELECT 1 FROM provider_operational_notifications WHERE event='MEMBER_SUSPENDED' AND "resolvedAt" IS NULL) THEN RAISE EXCEPTION 'Restoration not resolved'; END IF;
 UPDATE users SET status='BLOCKED' WHERE id='worker';
 IF NOT EXISTS(SELECT 1 FROM provider_account_signals WHERE "userId"='worker') THEN RAISE EXCEPTION 'Account restriction not queued'; END IF;
 UPDATE provider_profiles SET status='SUSPENDED' WHERE id='org';
 IF NOT EXISTS(SELECT 1 FROM provider_operational_notifications WHERE event='PROVIDER_SUSPENDED' AND "userId"='owner') THEN RAISE EXCEPTION 'Provider restriction not routed'; END IF;
 BEGIN
   INSERT INTO provider_operational_notifications(id,"providerId","userId",event) VALUES('bad','org','worker','WALLET_LOW_BALANCE');
   RAISE EXCEPTION 'Worker got owner alert';
 EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO provider_operational_notifications(id,"providerId","userId",event) VALUES('low','org','owner','WALLET_LOW_BALANCE');
 BEGIN
   INSERT INTO provider_operational_notifications(id,"providerId","userId",event) VALUES('duplicate-low','org','owner','WALLET_LOW_BALANCE');
   RAISE EXCEPTION 'Duplicate open low alert';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
   UPDATE provider_operational_notifications SET "userId"='other' WHERE id='low';
   RAISE EXCEPTION 'Recipient was mutable';
 EXCEPTION WHEN check_violation THEN NULL; END;
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
  'PASS: wallet unchanged, coalesced dirty signals, owner routing, state transitions, dedup and immutable recipients. Private schema rolled back.',
);
