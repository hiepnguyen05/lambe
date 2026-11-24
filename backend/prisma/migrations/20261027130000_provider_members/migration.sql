BEGIN;

CREATE TYPE "ProviderMemberRole" AS ENUM ('OWNER', 'WORKER');
CREATE TYPE "ProviderMemberStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LEFT');
CREATE TYPE "ProviderMemberInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

CREATE TABLE "provider_members" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProviderMemberRole" NOT NULL,
    "status" "ProviderMemberStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "canProvideServices" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_members_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "provider_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "provider_members_left_state_check" CHECK (("status" = 'LEFT') = ("leftAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "provider_members_providerId_userId_key" ON "provider_members"("providerId", "userId");
CREATE INDEX "provider_members_userId_status_idx" ON "provider_members"("userId", "status");
CREATE INDEX "provider_members_providerId_status_role_idx" ON "provider_members"("providerId", "status", "role");
CREATE INDEX "provider_members_providerId_joinedAt_id_idx" ON "provider_members"("providerId", "joinedAt", "id");
-- Pending and suspended workers retain their reservation until explicitly leaving.
CREATE UNIQUE INDEX "provider_members_one_serving_membership_per_user"
ON "provider_members"("userId") WHERE "canProvideServices" AND "status" <> 'LEFT';

CREATE TABLE "provider_member_invitations" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "ProviderMemberInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_member_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_member_invitations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "provider_member_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "provider_member_invitations_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "provider_member_invitations_token_hash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "provider_member_invitations_phone_check" CHECK ("phone" ~ '^0[35789][0-9]{8}$')
);

CREATE UNIQUE INDEX "provider_member_invitations_tokenHash_key" ON "provider_member_invitations"("tokenHash");
CREATE INDEX "provider_member_invitations_providerId_createdAt_id_idx" ON "provider_member_invitations"("providerId", "createdAt", "id");
CREATE INDEX "provider_member_invitations_phone_status_expiresAt_idx" ON "provider_member_invitations"("phone", "status", "expiresAt");
CREATE INDEX "provider_member_invitations_phone_createdAt_id_idx" ON "provider_member_invitations"("phone", "createdAt", "id");
CREATE UNIQUE INDEX "provider_member_invitations_one_pending_phone"
ON "provider_member_invitations"("providerId", "phone") WHERE "status" = 'PENDING';

-- PostgreSQL 16 provides gen_random_uuid() without an extension.
-- Organization representatives can manage the business, but are not verified workers.
INSERT INTO "provider_members" (
    "id", "providerId", "userId", "role", "status", "canProvideServices",
    "displayName", "avatarUrl", "joinedAt", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, p."id", p."userId",
       'OWNER', 'ACTIVE', p."providerType" = 'INDIVIDUAL',
       CASE WHEN p."providerType" = 'INDIVIDUAL' THEN p."displayName" ELSE u."fullName" END,
       u."avatarUrl", p."createdAt", p."createdAt", CURRENT_TIMESTAMP
FROM "provider_profiles" p JOIN "users" u ON u."id" = p."userId";

COMMIT;
