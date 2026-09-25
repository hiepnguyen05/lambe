CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");
CREATE INDEX "otp_codes_isUsed_createdAt_idx" ON "otp_codes"("isUsed", "createdAt");
CREATE INDEX "internal_sessions_expiresAt_idx" ON "internal_sessions"("expiresAt");
CREATE INDEX "internal_sessions_revokedAt_idx" ON "internal_sessions"("revokedAt");
