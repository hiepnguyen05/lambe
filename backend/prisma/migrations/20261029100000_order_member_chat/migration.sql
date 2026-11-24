BEGIN;
ALTER TABLE "chat_conversations"
  ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'CONSULTATION',
  ADD COLUMN "bookingOrderId" TEXT,
  ADD CONSTRAINT "chat_booking_order_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "chat_scope_check" CHECK ("scopeKey" = COALESCE("bookingOrderId", 'CONSULTATION'));
DROP INDEX "chat_conversations_customerId_providerId_key";
CREATE UNIQUE INDEX "chat_pair_scope_key" ON "chat_conversations" ("customerId","providerId","scopeKey");
CREATE UNIQUE INDEX "chat_booking_order_key" ON "chat_conversations" ("bookingOrderId");
-- Keep consultation history private to the original pair. Never copy its text/images to a new worker.
INSERT INTO "chat_conversations" ("id","customerId","providerId","scopeKey","bookingOrderId","lastSequence","lastMessageAt","createdAt","updatedAt")
SELECT gen_random_uuid()::text,o."customerId",o."providerId",o."id",o."id",1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "service_orders" o WHERE o."assignedMemberId" IS NOT NULL;
INSERT INTO "chat_participant_states" ("conversationId","userId","lastReadSequence","updatedAt")
SELECT c."id",u."userId",CASE WHEN u."userId"=c."customerId" THEN 1 ELSE 0 END,CURRENT_TIMESTAMP
FROM "chat_conversations" c JOIN "service_orders" o ON o."id"=c."bookingOrderId"
JOIN "provider_profiles" p ON p."id"=c."providerId"
CROSS JOIN LATERAL (SELECT DISTINCT v."userId" FROM (VALUES (c."customerId"),(p."userId"),(o."assignedMemberUserId")) AS v("userId")) u;
INSERT INTO "chat_messages" ("id","conversationId","sequence","kind","orderId","eventKey","payload")
SELECT gen_random_uuid()::text,c."id",1,'ORDER_EVENT',c."bookingOrderId",'order:' || c."bookingOrderId" || ':member-chat',
  jsonb_build_object('event','ORDER_CONTEXT_AVAILABLE') FROM "chat_conversations" c WHERE c."bookingOrderId" IS NOT NULL;
UPDATE "service_orders" o SET "conversationId"=c."id" FROM "chat_conversations" c WHERE c."bookingOrderId"=o."id";
INSERT INTO "audit_logs" ("id","action","resourceType","resourceId","result","metadata")
SELECT gen_random_uuid()::text,'ORDER_CHAT_MEMBER_GRANTED','ChatConversation',c."id",'SUCCESS',
 jsonb_build_object('orderId',o."id",'memberId',o."assignedMemberId",'membershipVersion',o."assignedMemberVersion",'source','MIGRATION')
 FROM "chat_conversations" c JOIN "service_orders" o ON o."id"=c."bookingOrderId";
CREATE FUNCTION "check_chat_booking_context"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW."customerId",NEW."providerId",NEW."scopeKey",NEW."bookingOrderId") IS DISTINCT FROM
    (OLD."customerId",OLD."providerId",OLD."scopeKey",OLD."bookingOrderId") THEN
    RAISE EXCEPTION 'Chat context is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW."bookingOrderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "service_orders" o WHERE o."id"=NEW."bookingOrderId"
    AND o."customerId"=NEW."customerId" AND o."providerId"=NEW."providerId" AND o."assignedMemberId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Chat must match assigned order context' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "chat_booking_context_check" BEFORE INSERT OR UPDATE ON "chat_conversations" FOR EACH ROW EXECUTE FUNCTION "check_chat_booking_context"();
CREATE FUNCTION "check_order_chat_link"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."conversationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "chat_conversations" c WHERE c."id"=NEW."conversationId"
    AND c."customerId"=NEW."customerId" AND c."providerId"=NEW."providerId"
    AND (c."bookingOrderId" IS NULL OR c."bookingOrderId"=NEW."id")) THEN
    RAISE EXCEPTION 'Order chat link must match customer/provider/order' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "order_chat_link_check" BEFORE INSERT OR UPDATE OF "conversationId","customerId","providerId" ON "service_orders"
FOR EACH ROW EXECUTE FUNCTION "check_order_chat_link"();
COMMIT;
