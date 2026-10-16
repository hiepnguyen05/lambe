CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'SERVICE_CARD', 'ORDER_EVENT');
CREATE TYPE "ChatReportReason" AS ENUM ('SPAM', 'ABUSE', 'OFF_PLATFORM', 'OTHER');

CREATE TABLE "chat_conversations" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_conversations_customerId_providerId_key" ON "chat_conversations"("customerId", "providerId");
CREATE INDEX "chat_conversations_customerId_lastMessageAt_idx" ON "chat_conversations"("customerId", "lastMessageAt");
CREATE INDEX "chat_conversations_providerId_lastMessageAt_idx" ON "chat_conversations"("providerId", "lastMessageAt");
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "chat_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "senderUserId" TEXT,
  "kind" "ChatMessageKind" NOT NULL,
  "text" TEXT,
  "providerServiceId" TEXT,
  "orderId" TEXT,
  "eventKey" TEXT,
  "payload" JSONB,
  "clientMessageId" TEXT,
  "requestHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_body_check" CHECK (
    ("kind" = 'TEXT' AND "text" IS NOT NULL AND "providerServiceId" IS NULL AND "orderId" IS NULL AND "senderUserId" IS NOT NULL)
    OR ("kind" = 'SERVICE_CARD' AND "providerServiceId" IS NOT NULL AND "text" IS NULL AND "orderId" IS NULL AND "senderUserId" IS NOT NULL)
    OR ("kind" = 'ORDER_EVENT' AND "orderId" IS NOT NULL AND "senderUserId" IS NULL AND "eventKey" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "chat_messages_conversationId_sequence_key" ON "chat_messages"("conversationId", "sequence");
CREATE UNIQUE INDEX "chat_messages_conversationId_senderUserId_clientMessageId_key" ON "chat_messages"("conversationId", "senderUserId", "clientMessageId");
CREATE UNIQUE INDEX "chat_messages_eventKey_key" ON "chat_messages"("eventKey");
CREATE INDEX "chat_messages_conversationId_sequence_idx" ON "chat_messages"("conversationId", "sequence" DESC);
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "chat_participant_states" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadSequence" INTEGER NOT NULL DEFAULT 0,
  "blockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_participant_states_pkey" PRIMARY KEY ("conversationId", "userId")
);
ALTER TABLE "chat_participant_states" ADD CONSTRAINT "chat_participant_states_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_participant_states" ADD CONSTRAINT "chat_participant_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "chat_reports" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT,
  "reporterUserId" TEXT NOT NULL,
  "reason" "ChatReportReason" NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_reports_conversationId_createdAt_idx" ON "chat_reports"("conversationId", "createdAt");
CREATE INDEX "chat_reports_reporterUserId_createdAt_idx" ON "chat_reports"("reporterUserId", "createdAt");
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_orders" ADD COLUMN "conversationId" TEXT;
CREATE INDEX "service_orders_conversationId_createdAt_idx" ON "service_orders"("conversationId", "createdAt");
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
