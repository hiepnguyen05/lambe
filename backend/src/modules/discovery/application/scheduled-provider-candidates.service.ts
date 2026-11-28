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
        WHERE p."providerType" = 'INDIVIDUAL' AND p."status" = 'ACTIVE' AND p."setupCompletedAt" IS NOT NULL
          AND p."serviceRadiusKm" IS NOT NULL
          AND point(p."serviceAreaLongitude", p."serviceAreaLatitude") <@
            box(point(${longitude - lonDelta}::float8, ${latitude - latDelta}::float8), point(${longitude + lonDelta}::float8, ${latitude + latDelta}::float8))
          AND EXISTS (SELECT 1 FROM "provider_services" ps WHERE ps."providerId" = p."id" AND ps."serviceId" = ${serviceId} AND ps."status" = 'ACTIVE')
          AND NOT EXISTS (SELECT 1 FROM "service_orders" so WHERE so."providerId" = p."id" AND so."status" = 'SAFETY_HOLD')
      ) c
      WHERE c."distanceKm" <= ${radiusKm} AND c."distanceKm" <= c."serviceRadiusKm"
      ORDER BY c."distanceKm", c."providerId" LIMIT 300
    `);
  }

  findAllInArea(latitude: number, longitude: number, radiusKm: number) {
    const latDelta = radiusKm / 110.5;
    const lonDelta = Math.min(
      180,
      radiusKm / (110.5 * Math.max(0.01, Math.cos((latitude * Math.PI) / 180))),
    );
    return this.prisma.$queryRaw<
      Array<{
        providerId: string;
        serviceAreaLatitude: number;
        serviceAreaLongitude: number;
        serviceRadiusKm: number;
      }>
    >(Prisma.sql`
      SELECT c."providerId", c."serviceAreaLatitude", c."serviceAreaLongitude", c."serviceRadiusKm" FROM (
        SELECT p."id" AS "providerId",
          p."serviceAreaLatitude",
          p."serviceAreaLongitude",
          p."serviceRadiusKm",
          6371 * acos(least(1.0, greatest(-1.0,
            sin(radians(${latitude}::float8)) * sin(radians(p."serviceAreaLatitude")) +
            cos(radians(${latitude}::float8)) * cos(radians(p."serviceAreaLatitude")) *
            cos(radians(p."serviceAreaLongitude" - ${longitude}::float8))))) AS "distanceKm"
        FROM "provider_profiles" p
        WHERE p."providerType" = 'INDIVIDUAL' AND p."status" = 'ACTIVE' AND p."setupCompletedAt" IS NOT NULL
          AND p."serviceRadiusKm" IS NOT NULL
          AND point(p."serviceAreaLongitude", p."serviceAreaLatitude") <@
            box(point(${longitude - lonDelta}::float8, ${latitude - latDelta}::float8), point(${longitude + lonDelta}::float8, ${latitude + latDelta}::float8))
          AND EXISTS (
            SELECT 1 FROM "provider_services" ps
            JOIN "services" s ON s."id" = ps."serviceId"
            JOIN "service_categories" sc ON sc."id" = s."categoryId"
            WHERE ps."providerId" = p."id" AND ps."status" = 'ACTIVE'
              AND s."status" = 'ACTIVE' AND sc."status" = 'ACTIVE'
          )
          AND NOT EXISTS (SELECT 1 FROM "service_orders" so WHERE so."providerId" = p."id" AND so."status" = 'SAFETY_HOLD')
      ) c
      WHERE c."distanceKm" <= ${radiusKm} AND c."distanceKm" <= c."serviceRadiusKm"
      ORDER BY c."distanceKm", c."providerId" LIMIT 300
    `);
  }

  findMembers(
    serviceId: string,
    latitude: number,
    longitude: number,
    radiusKm: number,
  ) {
    const latDelta = radiusKm / 110.5;
    const lonDelta = Math.min(
      180,
      radiusKm / (110.5 * Math.max(0.01, Math.cos((latitude * Math.PI) / 180))),
    );
    return this.prisma.$queryRaw<
      Array<{ memberId: string; providerId: string; distanceKm: number }>
    >(Prisma.sql`
      SELECT c."memberId", c."providerId", c."distanceKm" FROM (
        SELECT m."id" AS "memberId", p."id" AS "providerId", least(p."serviceRadiusKm", coalesce(m."receivingRadiusKm", p."serviceRadiusKm")) AS radius,
          6371 * acos(least(1.0, greatest(-1.0, sin(radians(${latitude}::float8)) * sin(radians(p."serviceAreaLatitude")) + cos(radians(${latitude}::float8)) * cos(radians(p."serviceAreaLatitude")) * cos(radians(p."serviceAreaLongitude" - ${longitude}::float8))))) AS "distanceKm"
        FROM "provider_profiles" p JOIN "provider_members" m ON m."providerId"=p."id"
        WHERE p."providerType"='ORGANIZATION' AND p."status"='ACTIVE' AND p."acceptingMemberOrders" AND p."setupCompletedAt" IS NOT NULL AND p."serviceRadiusKm" IS NOT NULL
          AND m."status"='ACTIVE' AND m."canProvideServices"
          AND point(p."serviceAreaLongitude", p."serviceAreaLatitude") <@ box(point(${longitude - lonDelta}::float8, ${latitude - latDelta}::float8), point(${longitude + lonDelta}::float8, ${latitude + latDelta}::float8))
          AND EXISTS (SELECT 1 FROM "provider_member_services" a JOIN "provider_services" s ON s."id"=a."providerServiceId"
            WHERE a."memberId"=m."id" AND a."membershipVersion"=m."membershipVersion" AND a."enabled" AND s."serviceId"=${serviceId} AND s."status"='ACTIVE')
          AND NOT EXISTS (SELECT 1 FROM "service_orders" o WHERE o."providerId"=p."id" AND o."status"='SAFETY_HOLD')
      ) c WHERE c."distanceKm" <= ${radiusKm} AND c."distanceKm" <= c.radius
      ORDER BY c."distanceKm", c."memberId" LIMIT 300
    `);
  }
}
