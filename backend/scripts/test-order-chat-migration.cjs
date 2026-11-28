// Rehearse room separation without touching application data or copying private messages.
const {
  readMigration,
  runRehearsal,
  temporarySchema,
} = require('./migration-rehearsal.cjs');
const schema = temporarySchema('chat_rehearsal');
const migration = readMigration(
  '../prisma/migrations/20261029100000_order_member_chat/migration.sql',
);
const sql = `
CREATE SCHEMA "${schema}";
SET search_path TO "${schema}",public;
CREATE TABLE users (id TEXT PRIMARY KEY);
INSERT INTO users VALUES ('customer'),('owner'),('worker-a'),('worker-b');
CREATE TABLE provider_profiles (id TEXT PRIMARY KEY,"userId" TEXT NOT NULL);
INSERT INTO provider_profiles VALUES ('organization','owner');
CREATE TABLE service_orders (id TEXT PRIMARY KEY,"customerId" TEXT NOT NULL,"providerId" TEXT NOT NULL,
  "assignedMemberId" TEXT,"assignedMemberUserId" TEXT,"assignedMemberVersion" INTEGER,"conversationId" TEXT);
CREATE TABLE chat_conversations (id TEXT PRIMARY KEY,"customerId" TEXT NOT NULL,"providerId" TEXT NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,"lastMessageAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX "chat_conversations_customerId_providerId_key" ON chat_conversations("customerId","providerId");
CREATE TABLE chat_participant_states ("conversationId" TEXT REFERENCES chat_conversations(id),"userId" TEXT REFERENCES users(id),
  "lastReadSequence" INTEGER NOT NULL DEFAULT 0,"updatedAt" TIMESTAMP NOT NULL,PRIMARY KEY("conversationId","userId"));
CREATE TABLE chat_messages (id TEXT PRIMARY KEY,"conversationId" TEXT NOT NULL REFERENCES chat_conversations(id),sequence INTEGER NOT NULL,
  kind TEXT NOT NULL,text TEXT,"orderId" TEXT,"eventKey" TEXT UNIQUE,payload JSONB);
CREATE TABLE audit_logs (id TEXT PRIMARY KEY,action TEXT NOT NULL,"resourceType" TEXT NOT NULL,"resourceId" TEXT,result TEXT NOT NULL,metadata JSONB);
INSERT INTO chat_conversations (id,"customerId","providerId","updatedAt") VALUES ('old-consultation','customer','organization',CURRENT_TIMESTAMP);
INSERT INTO chat_messages (id,"conversationId",sequence,kind,text) VALUES ('private-message','old-consultation',1,'TEXT','PRIVATE OLD CONSULTATION');
INSERT INTO service_orders VALUES
  ('order-a','customer','organization','member-a','worker-a',1,'old-consultation'),
  ('order-b','customer','organization','member-b','worker-b',1,'old-consultation'),
  ('legacy','customer','organization',NULL,NULL,NULL,'old-consultation');
${migration}
DO $verify$
DECLARE a TEXT; b TEXT;
BEGIN
  SELECT "conversationId" INTO a FROM service_orders WHERE id='order-a';
  SELECT "conversationId" INTO b FROM service_orders WHERE id='order-b';
  IF a=b OR a='old-consultation' OR b='old-consultation' THEN RAISE EXCEPTION 'Worker rooms not isolated'; END IF;
  IF (SELECT count(*) FROM chat_conversations)<>3 THEN RAISE EXCEPTION 'Incorrect room count'; END IF;
  IF NOT EXISTS(SELECT 1 FROM service_orders WHERE id='legacy' AND "conversationId"='old-consultation') THEN RAISE EXCEPTION 'Legacy order changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM chat_messages WHERE id='private-message' AND "conversationId"='old-consultation' AND text='PRIVATE OLD CONSULTATION') THEN RAISE EXCEPTION 'Consultation history changed'; END IF;
  IF EXISTS(SELECT 1 FROM chat_messages WHERE "conversationId" IN(a,b) AND text IS NOT NULL) THEN RAISE EXCEPTION 'Private text copied to workers'; END IF;
  IF EXISTS(SELECT 1 FROM chat_participant_states WHERE ("conversationId"=a AND "userId"='worker-b') OR ("conversationId"=b AND "userId"='worker-a')) THEN RAISE EXCEPTION 'Foreign worker granted'; END IF;
  IF (SELECT count(*) FROM chat_participant_states)<>6 OR (SELECT count(*) FROM audit_logs WHERE action='ORDER_CHAT_MEMBER_GRANTED')<>2 THEN RAISE EXCEPTION 'Participant/audit backfill incomplete'; END IF;
  BEGIN
    UPDATE service_orders SET "conversationId"=b WHERE id='order-a';
    RAISE EXCEPTION 'Wrong room link accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE chat_conversations SET "scopeKey"='changed' WHERE id=a;
    RAISE EXCEPTION 'Room context was mutable';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $verify$;
DROP SCHEMA "${schema}" CASCADE;
`;
runRehearsal(
  sql,
  'PASS: consultation preserved, separate order rooms, exact worker grants/audit, legacy links retained, immutable context and wrong-order link rejection.',
);
