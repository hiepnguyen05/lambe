CREATE TYPE "AiFeedbackReason" AS ENUM ('NOT_RELEVANT', 'INCORRECT', 'UNSAFE', 'OTHER');

CREATE TABLE "ai_message_feedback" (
  "messageId" TEXT NOT NULL,
  "helpful" BOOLEAN NOT NULL,
  "reason" "AiFeedbackReason",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_message_feedback_pkey" PRIMARY KEY ("messageId")
);

ALTER TABLE "ai_message_feedback"
  ADD CONSTRAINT "ai_message_feedback_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
