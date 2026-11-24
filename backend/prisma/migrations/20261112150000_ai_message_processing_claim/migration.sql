ALTER TABLE "ai_messages"
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE TABLE "ai_usage_entries" (
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  CONSTRAINT "ai_usage_entries_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX "ai_usage_entries_userId_day_idx" ON "ai_usage_entries"("userId", "day");
ALTER TABLE "ai_usage_entries" ADD CONSTRAINT "ai_usage_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ai_usage_entries" ("messageId", "userId", "day")
SELECT m."id", c."userId", m."createdAt"::date
FROM "ai_messages" m
JOIN "ai_conversations" c ON c."id" = m."conversationId"
WHERE m."role" = 'user' AND m."result" IS NOT NULL AND m."result" <> 'null'::jsonb;
