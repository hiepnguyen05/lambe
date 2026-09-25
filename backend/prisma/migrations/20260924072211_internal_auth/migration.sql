-- CreateEnum
CREATE TYPE "InternalAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "InternalRole" AS ENUM ('ADMIN', 'MODERATOR');

-- CreateTable
CREATE TABLE "internal_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "normalizedUsername" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "status" "InternalAccountStatus" NOT NULL DEFAULT 'INVITED',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "disabledById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_credentials" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL DEFAULT 'argon2id',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_role_assignments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "InternalRole" NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "internal_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorInternalAccountId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_accounts_normalizedUsername_key" ON "internal_accounts"("normalizedUsername");

-- CreateIndex
CREATE UNIQUE INDEX "internal_accounts_email_key" ON "internal_accounts"("email");

-- CreateIndex
CREATE INDEX "internal_accounts_status_idx" ON "internal_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "internal_credentials_accountId_key" ON "internal_credentials"("accountId");

-- CreateIndex
CREATE INDEX "internal_role_assignments_role_revokedAt_idx" ON "internal_role_assignments"("role", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "internal_role_assignments_accountId_role_key" ON "internal_role_assignments"("accountId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "internal_sessions_refreshTokenHash_key" ON "internal_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "internal_sessions_accountId_revokedAt_expiresAt_idx" ON "internal_sessions"("accountId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorInternalAccountId_createdAt_idx" ON "audit_logs"("actorInternalAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "internal_credentials" ADD CONSTRAINT "internal_credentials_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "internal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_role_assignments" ADD CONSTRAINT "internal_role_assignments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "internal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_sessions" ADD CONSTRAINT "internal_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "internal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
