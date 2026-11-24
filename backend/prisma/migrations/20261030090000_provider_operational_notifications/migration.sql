BEGIN;
ALTER TABLE push_outbox ADD COLUMN "sourceId" TEXT;
CREATE TABLE provider_operational_notifications (
  id TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL,
  event VARCHAR(80) NOT NULL,
  "memberId" TEXT,
  "membershipVersion" INTEGER,
  "readAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "pushQueuedAt" TIMESTAMP(3), "streamSequence" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT provider_operational_event_check CHECK(event IN ('WALLET_LOW_BALANCE','MEMBER_SUSPENDED','MEMBER_LEFT','MEMBER_ACCOUNT_RESTRICTED','PROVIDER_SUSPENDED')),
  CONSTRAINT provider_operational_member_check CHECK(
    (event IN ('WALLET_LOW_BALANCE','PROVIDER_SUSPENDED') AND "memberId" IS NULL AND "membershipVersion" IS NULL)
    OR (event IN ('MEMBER_SUSPENDED','MEMBER_LEFT','MEMBER_ACCOUNT_RESTRICTED') AND "memberId" IS NOT NULL AND "membershipVersion" IS NOT NULL AND "membershipVersion">0)
  )
);
CREATE INDEX "provider_operational_notifications_userId_createdAt_id_idx" ON provider_operational_notifications("userId","createdAt",id);
CREATE INDEX "provider_operational_notifications_userId_readAt_idx" ON provider_operational_notifications("userId","readAt");
CREATE INDEX "provider_operational_notifications_providerId_event_resolvedAt_idx" ON provider_operational_notifications("providerId",event,"resolvedAt");
CREATE INDEX "provider_operational_notifications_publishedAt_createdAt_idx" ON provider_operational_notifications("publishedAt","createdAt");
CREATE INDEX "provider_operational_notifications_pushQueuedAt_createdAt_idx" ON provider_operational_notifications("pushQueuedAt","createdAt");
CREATE UNIQUE INDEX provider_wallet_one_open_alert ON provider_operational_notifications("providerId") WHERE event='WALLET_LOW_BALANCE' AND "resolvedAt" IS NULL;
CREATE UNIQUE INDEX provider_account_one_open_alert ON provider_operational_notifications("providerId","memberId","membershipVersion") WHERE event='MEMBER_ACCOUNT_RESTRICTED' AND "resolvedAt" IS NULL;
CREATE UNIQUE INDEX provider_notification_stream_key ON provider_operational_notifications("providerId","streamSequence");
CREATE INDEX provider_notification_unsequenced_idx ON provider_operational_notifications("createdAt",id) WHERE "streamSequence" IS NULL;
CREATE TABLE provider_notification_counters ("providerId" TEXT PRIMARY KEY REFERENCES provider_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE, "lastSequence" BIGINT NOT NULL DEFAULT 0);
CREATE TABLE provider_account_signals ("userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "provider_account_signals_updatedAt_userId_idx" ON provider_account_signals("updatedAt","userId");
CREATE TABLE provider_wallet_signals (
  "walletId" TEXT PRIMARY KEY REFERENCES provider_wallets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "provider_wallet_signals_updatedAt_walletId_idx" ON provider_wallet_signals("updatedAt","walletId");

CREATE FUNCTION guard_provider_operation_recipient() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD."streamSequence" IS NOT NULL AND NEW."streamSequence" IS DISTINCT FROM OLD."streamSequence" THEN
    RAISE EXCEPTION 'Notification stream sequence is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ROW(NEW."providerId",NEW."userId",NEW.event,NEW."memberId",NEW."membershipVersion",NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."providerId",OLD."userId",OLD.event,OLD."memberId",OLD."membershipVersion",OLD."createdAt") THEN
    RAISE EXCEPTION 'Operational notification context is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM provider_profiles WHERE id=NEW."providerId" AND "userId"=NEW."userId") THEN
    RAISE EXCEPTION 'Operational notification belongs to provider owner' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NEW."memberId" IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM provider_members WHERE id=NEW."memberId" AND "providerId"=NEW."providerId" AND "membershipVersion"=NEW."membershipVersion"
  ) THEN RAISE EXCEPTION 'Operational notification membership mismatch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_operation_recipient_guard BEFORE INSERT OR UPDATE ON provider_operational_notifications FOR EACH ROW EXECUTE FUNCTION guard_provider_operation_recipient();

-- A coalesced dirty signal, not a hardcoded financial policy. App worker uses the configured receiving minimum.
CREATE FUNCTION signal_provider_wallet_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO provider_wallet_signals("walletId") VALUES(NEW.id)
  ON CONFLICT("walletId") DO UPDATE SET "updatedAt"=clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER provider_wallet_notification_signal AFTER INSERT OR UPDATE OF "balanceAmount","heldAmount" ON provider_wallets FOR EACH ROW EXECUTE FUNCTION signal_provider_wallet_change();
INSERT INTO provider_wallet_signals("walletId") SELECT id FROM provider_wallets;

CREATE FUNCTION notify_provider_member_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT "userId" INTO owner_id FROM provider_profiles WHERE id=NEW."providerId" AND "providerType"::text='ORGANIZATION';
  IF owner_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status::text='SUSPENDED' THEN
    UPDATE provider_operational_notifications SET "resolvedAt"=clock_timestamp()
    WHERE "providerId"=NEW."providerId" AND "memberId"=NEW.id AND event='MEMBER_SUSPENDED' AND "resolvedAt" IS NULL;
  END IF;
  IF OLD.status::text='LEFT' THEN
    UPDATE provider_operational_notifications SET "resolvedAt"=clock_timestamp()
    WHERE "providerId"=NEW."providerId" AND "memberId"=NEW.id AND event='MEMBER_LEFT' AND "resolvedAt" IS NULL;
  END IF;
  IF NEW.status::text='LEFT' THEN
    UPDATE provider_operational_notifications SET "resolvedAt"=clock_timestamp()
    WHERE "providerId"=NEW."providerId" AND "memberId"=NEW.id AND event='MEMBER_ACCOUNT_RESTRICTED' AND "resolvedAt" IS NULL;
  END IF;
  IF NEW.status::text IN ('SUSPENDED','LEFT') THEN
    INSERT INTO provider_operational_notifications(id,"providerId","userId",event,"memberId","membershipVersion")
    VALUES(gen_random_uuid()::text,NEW."providerId",owner_id,CASE WHEN NEW.status::text='SUSPENDED' THEN 'MEMBER_SUSPENDED' ELSE 'MEMBER_LEFT' END,NEW.id,NEW."membershipVersion");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_member_operation_notification AFTER UPDATE OF status ON provider_members FOR EACH ROW EXECUTE FUNCTION notify_provider_member_status();

CREATE FUNCTION notify_provider_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO provider_wallet_signals("walletId") SELECT id FROM provider_wallets WHERE "providerId"=NEW.id
  ON CONFLICT("walletId") DO UPDATE SET "updatedAt"=clock_timestamp();
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status::text='SUSPENDED' THEN
      INSERT INTO provider_operational_notifications(id,"providerId","userId",event) VALUES(gen_random_uuid()::text,NEW.id,NEW."userId",'PROVIDER_SUSPENDED');
    ELSE
      UPDATE provider_operational_notifications SET "resolvedAt"=clock_timestamp() WHERE "providerId"=NEW.id AND event='PROVIDER_SUSPENDED' AND "resolvedAt" IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provider_status_operation_notification AFTER UPDATE OF status,"setupCompletedAt" ON provider_profiles FOR EACH ROW EXECUTE FUNCTION notify_provider_status();

CREATE FUNCTION notify_member_account_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  -- No provider/member locks while the account writer holds the users row.
  INSERT INTO provider_account_signals("userId") VALUES(NEW.id)
  ON CONFLICT("userId") DO UPDATE SET "updatedAt"=clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER provider_member_account_operation_notification AFTER UPDATE OF status ON users FOR EACH ROW EXECUTE FUNCTION notify_member_account_status();
COMMIT;
