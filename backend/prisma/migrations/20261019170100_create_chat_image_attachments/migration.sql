ALTER TABLE "chat_messages"
  DROP CONSTRAINT "chat_messages_body_check";

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_body_check" CHECK (
    ("kind" = 'TEXT' AND "text" IS NOT NULL AND "providerServiceId" IS NULL AND "orderId" IS NULL AND "senderUserId" IS NOT NULL)
    OR ("kind" = 'IMAGE' AND "text" IS NULL AND "providerServiceId" IS NULL AND "orderId" IS NULL AND "senderUserId" IS NOT NULL)
    OR ("kind" = 'SERVICE_CARD' AND "providerServiceId" IS NOT NULL AND "text" IS NULL AND "orderId" IS NULL AND "senderUserId" IS NOT NULL)
    OR ("kind" = 'ORDER_EVENT' AND "orderId" IS NOT NULL AND "senderUserId" IS NULL AND "eventKey" IS NOT NULL)
  );

CREATE TABLE "chat_attachments" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "fileFormat" TEXT NOT NULL,
  "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
  "byteSize" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachments_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
  CONSTRAINT "chat_attachments_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "width" <= 12000 AND "height" <= 12000),
  CONSTRAINT "chat_attachments_position_check" CHECK ("position" >= 0 AND "position" < 4),
  CONSTRAINT "chat_attachments_delivery_check" CHECK ("deliveryType" = 'authenticated')
);

CREATE UNIQUE INDEX "chat_attachments_publicId_key"
  ON "chat_attachments"("publicId");
CREATE UNIQUE INDEX "chat_attachments_messageId_position_key"
  ON "chat_attachments"("messageId", "position");
CREATE INDEX "chat_attachments_messageId_idx"
  ON "chat_attachments"("messageId");

ALTER TABLE "chat_attachments"
  ADD CONSTRAINT "chat_attachments_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
