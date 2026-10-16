CREATE TYPE "OrderEvidenceType" AS ENUM ('ARRIVAL', 'BEFORE_WORK', 'AFTER_WORK', 'INCIDENT');
CREATE TYPE "OrderCancellationStatus" AS ENUM ('PENDING_CUSTOMER', 'SUPPORT_REVIEW', 'APPROVED', 'DENIED');
CREATE TYPE "OrderCancellationReason" AS ENUM ('TRANSPORT_ISSUE', 'CUSTOMER_UNREACHABLE', 'LOCATION_INACCESSIBLE', 'UNSAFE_CONDITIONS', 'OTHER');

CREATE TABLE "order_evidence" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "OrderEvidenceType" NOT NULL,
  "publicId" TEXT NOT NULL,
  "fileFormat" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_evidence_location_pair" CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);
CREATE UNIQUE INDEX "order_evidence_orderId_type_key" ON "order_evidence"("orderId", "type");
CREATE UNIQUE INDEX "order_evidence_publicId_key" ON "order_evidence"("publicId");
ALTER TABLE "order_evidence" ADD CONSTRAINT "order_evidence_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_cancellation_requests" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "reason" "OrderCancellationReason" NOT NULL,
  "detail" TEXT NOT NULL,
  "status" "OrderCancellationStatus" NOT NULL DEFAULT 'PENDING_CUSTOMER',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  CONSTRAINT "order_cancellation_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_cancellation_requests_orderId_key" ON "order_cancellation_requests"("orderId");
CREATE INDEX "order_cancellation_requests_status_requestedAt_idx" ON "order_cancellation_requests"("status", "requestedAt");
ALTER TABLE "order_cancellation_requests" ADD CONSTRAINT "order_cancellation_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_reviews" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "order_reviews_orderId_key" ON "order_reviews"("orderId");
CREATE INDEX "order_reviews_providerId_createdAt_idx" ON "order_reviews"("providerId", "createdAt");
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_notifications_userId_createdAt_idx" ON "order_notifications"("userId", "createdAt");
CREATE INDEX "order_notifications_userId_readAt_createdAt_idx" ON "order_notifications"("userId", "readAt", "createdAt");
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
