-- AlterTable
ALTER TABLE "feed_media_cleanup" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN     "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workPausedAt" TIMESTAMP(3),
ALTER COLUMN "bookingGroupId" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "voucher_redemptions" RENAME CONSTRAINT "voucher_redemptions_customer_fkey" TO "voucher_redemptions_customerId_fkey";

-- RenameForeignKey
ALTER TABLE "voucher_redemptions" RENAME CONSTRAINT "voucher_redemptions_order_fkey" TO "voucher_redemptions_orderId_fkey";

-- RenameForeignKey
ALTER TABLE "voucher_redemptions" RENAME CONSTRAINT "voucher_redemptions_voucher_fkey" TO "voucher_redemptions_voucherId_fkey";

-- RenameForeignKey
ALTER TABLE "vouchers" RENAME CONSTRAINT "vouchers_provider_fkey" TO "vouchers_providerId_fkey";

-- RenameForeignKey
ALTER TABLE "vouchers" RENAME CONSTRAINT "vouchers_service_fkey" TO "vouchers_serviceId_fkey";

-- RenameIndex
ALTER INDEX "feed_media_cleanup_completed_failed_available_idx" RENAME TO "feed_media_cleanup_completedAt_failedAt_availableAt_idx";

-- RenameIndex
ALTER INDEX "provider_application_terms_acceptances_applicationId_termsVersi" RENAME TO "provider_application_terms_acceptances_applicationId_termsV_key";

-- RenameIndex
ALTER INDEX "provider_operational_notifications_providerId_event_resolvedAt_" RENAME TO "provider_operational_notifications_providerId_event_resolve_idx";

-- RenameIndex
ALTER INDEX "provider_service_change_requests_providerId_status_createdAt_id" RENAME TO "provider_service_change_requests_providerId_status_createdA_idx";

-- RenameIndex
ALTER INDEX "provider_service_suggestions_applicationId_categoryId_normalize" RENAME TO "provider_service_suggestions_applicationId_categoryId_norma_key";
