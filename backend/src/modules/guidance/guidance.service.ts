import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/persistence/postgres/prisma.service';
import type { SaveGuidanceDto } from './guidance.dto';

const progressSelect = {
  tourId: true,
  version: true,
  stepIndex: true,
  status: true,
  updatedAt: true,
} as const;

@Injectable()
export class GuidanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const data = await this.prisma.userGuidanceProgress.findMany({
      where: { userId },
      select: progressSelect,
    });
    return { success: true, data };
  }

  async save(userId: string, tourId: string, dto: SaveGuidanceDto) {
    // A late offline write from another device cannot undo completion.
    const rows = await this.prisma.$queryRaw<
      {
        tourId: string;
        version: number;
        stepIndex: number;
        status: string;
        updatedAt: Date;
      }[]
    >(Prisma.sql`
      INSERT INTO "user_guidance_progress" ("userId", "tourId", "version", "stepIndex", "status", "updatedAt")
      VALUES (${userId}, ${tourId}, ${dto.version}, ${dto.stepIndex}, ${dto.status}, NOW())
      ON CONFLICT ("userId", "tourId", "version") DO UPDATE SET
        "stepIndex" = CASE WHEN "user_guidance_progress"."status" = 'COMPLETED' THEN "user_guidance_progress"."stepIndex" ELSE EXCLUDED."stepIndex" END,
        "status" = CASE WHEN "user_guidance_progress"."status" = 'COMPLETED' THEN 'COMPLETED' ELSE EXCLUDED."status" END,
        "updatedAt" = NOW()
      RETURNING "tourId", "version", "stepIndex", "status", "updatedAt"
    `);
    return { success: true, data: rows[0] };
  }
}
