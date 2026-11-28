CREATE TABLE "user_guidance_progress" (
  "userId" TEXT NOT NULL,
  "tourId" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL,
  "stepIndex" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(16) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_guidance_progress_pkey" PRIMARY KEY ("userId", "tourId", "version"),
  CONSTRAINT "user_guidance_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_guidance_progress_status_check" CHECK ("status" IN ('STARTED', 'DISMISSED', 'COMPLETED')),
  CONSTRAINT "user_guidance_progress_step_check" CHECK ("stepIndex" BETWEEN 0 AND 20 AND "version" BETWEEN 1 AND 100)
);
