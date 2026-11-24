BEGIN;
CREATE TYPE "ProviderMemberVerificationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED');

ALTER TABLE "provider_members"
    ADD COLUMN "membershipVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "suspendedAt" TIMESTAMP(3),
    ADD COLUMN "suspensionReason" TEXT,
    ADD COLUMN "suspendedFromStatus" "ProviderMemberStatus",
    ADD COLUMN "suspensionSource" TEXT,
    ADD CONSTRAINT "provider_members_suspension_source_check" CHECK ("suspensionSource" IS NULL OR "suspensionSource" IN ('OWNER', 'INTERNAL')),
    ADD CONSTRAINT "provider_members_membershipVersion_check" CHECK ("membershipVersion" > 0);

CREATE TABLE "provider_member_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL REFERENCES "provider_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "membershipVersion" INTEGER NOT NULL,
    "status" "ProviderMemberVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "legalFullName" TEXT,
    "birthDate" DATE,
    "gender" "Gender",
    "experienceYears" INTEGER,
    "nationalIdEncrypted" TEXT,
    "nationalIdHash" TEXT,
    "nationalIdLast4" TEXT,
    "requestedProviderServiceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "termsVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_member_verifications_revision_check" CHECK ("membershipVersion" > 0 AND "revisionNumber" >= 0)
);
CREATE UNIQUE INDEX "provider_member_verifications_memberId_membershipVersion_key" ON "provider_member_verifications"("memberId", "membershipVersion");
CREATE INDEX "provider_member_verifications_status_submittedAt_id_idx" ON "provider_member_verifications"("status", "submittedAt", "id");

CREATE TABLE "provider_member_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verificationId" TEXT NOT NULL REFERENCES "provider_member_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "type" "ProviderDocumentType" NOT NULL,
    "providerServiceId" TEXT REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "publicId" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
    "expiresAt" TIMESTAMP(3),
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_member_documents_private_check" CHECK ("deliveryType" = 'authenticated' AND "fileFormat" IN ('jpg', 'jpeg', 'png', 'gif', 'webp')),
    CONSTRAINT "provider_member_documents_type_check" CHECK ("type" IN ('PORTRAIT', 'ID_CARD_FRONT', 'ID_CARD_BACK', 'IDENTITY_SELFIE', 'PROFESSIONAL_CERTIFICATE', 'PORTFOLIO')),
    CONSTRAINT "provider_member_documents_service_link_check" CHECK (
        ("type" <> 'PROFESSIONAL_CERTIFICATE' OR "providerServiceId" IS NOT NULL)
        AND ("type" IN ('PROFESSIONAL_CERTIFICATE', 'PORTFOLIO') OR "providerServiceId" IS NULL)
        AND ("type" = 'PROFESSIONAL_CERTIFICATE' OR "expiresAt" IS NULL)
    )
);
CREATE UNIQUE INDEX "provider_member_documents_publicId_key" ON "provider_member_documents"("publicId");
CREATE UNIQUE INDEX "provider_member_documents_current_singleton" ON "provider_member_documents"("verificationId", "type")
WHERE "supersededAt" IS NULL AND "type" IN ('PORTRAIT', 'ID_CARD_FRONT', 'ID_CARD_BACK', 'IDENTITY_SELFIE');
CREATE INDEX "provider_member_documents_verificationId_supersededAt_type_idx" ON "provider_member_documents"("verificationId", "supersededAt", "type");
CREATE INDEX "provider_member_documents_providerServiceId_expiresAt_idx" ON "provider_member_documents"("providerServiceId", "expiresAt");

CREATE TABLE "provider_member_verification_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verificationId" TEXT NOT NULL REFERENCES "provider_member_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "revisionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "provider_member_verification_revisions_revision_key" ON "provider_member_verification_revisions"("verificationId", "revisionNumber");
COMMIT;
