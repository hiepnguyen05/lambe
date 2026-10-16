import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class ScheduledProviderCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  find(
    serviceId: string,
    latitude: number,
    longitude: number,
    radiusKm: number,
  ) {
    // Bounding box uses PostgreSQL's built-in point GiST index; spherical distance is the final filter.
    const latDelta = radiusKm / 110.5;
    const lonDelta = Math.min(
      180,
      radiusKm / (110.5 * Math.max(0.01, Math.cos((latitude * Math.PI) / 180))),
    );
    return this.prisma.$queryRaw<
      Array<{ providerId: string; distanceKm: number }>
    >(Prisma.sql`
      SELECT c."providerId", c."distanceKm" FROM (
        SELECT p."id" AS "providerId", p."serviceRadiusKm",
          6371 * acos(least(1.0, greatest(-1.0,
            sin(radians(${latitude}::float8)) * sin(radians(p."serviceAreaLatitude")) +
            cos(radians(${latitude}::float8)) * cos(radians(p."serviceAreaLatitude")) *
            cos(radians(p."serviceAreaLongitude" - ${longitude}::float8))))) AS "distanceKm"
        FROM "provider_profiles" p
        WHERE p."status" = 'ACTIVE' AND p."setupCompletedAt" IS NOT NULL
          AND p."serviceRadiusKm" IS NOT NULL
          AND point(p."serviceAreaLongitude", p."serviceAreaLatitude") <@
            box(point(${longitude - lonDelta}::float8, ${latitude - latDelta}::float8), point(${longitude + lonDelta}::float8, ${latitude + latDelta}::float8))
          AND EXISTS (SELECT 1 FROM "provider_services" ps WHERE ps."providerId" = p."id" AND ps."serviceId" = ${serviceId} AND ps."status" = 'ACTIVE')
      ) c
      WHERE c."distanceKm" <= ${radiusKm} AND c."distanceKm" <= c."serviceRadiusKm"
      ORDER BY c."distanceKm", c."providerId" LIMIT 300
    `);
  }
}
