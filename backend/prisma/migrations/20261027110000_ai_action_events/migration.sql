CREATE TABLE "ai_action_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_action_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_action_events_userId_createdAt_idx" ON "ai_action_events"("userId", "createdAt");
CREATE INDEX "ai_action_events_actionType_createdAt_idx" ON "ai_action_events"("actionType", "createdAt");
ALTER TABLE "ai_action_events" ADD CONSTRAINT "ai_action_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_action_events" ADD CONSTRAINT "ai_action_events_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
