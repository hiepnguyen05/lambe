import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type FeedPostStatus,
  type ProviderServiceStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

export interface LivePublicPost {
  id: string;
  providerId: string;
  status: FeedPostStatus;
  revisionNumber: number;
  createdAt: Date;
  updatedAt: Date;
  provider: { id: string; displayName: string; avatarUrl: string | null };
  services: {
    providerService: {
      id: string;
      priceAmount: number;
      durationMinutes: number | null;
      status: ProviderServiceStatus;
      service: {
        id: string;
        name: string;
        categoryId: string;
        category?: { slug: string } | null;
        categorySlug?: string;
      };
    };
  }[];
  _count: { likes: number; comments: number; saves: number };
}

/** Live joins are one DB round trip. No cached visibility, price or personal state. */
@Injectable()
export class FeedLiveReadService {
  constructor(private readonly prisma: PrismaService) {}
  async load(ids: string[]): Promise<LivePublicPost[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.$queryRaw<LivePublicPost[]>(Prisma.sql`
      SELECT p.id,p."providerId",p.status,p."revisionNumber",p."createdAt",p."updatedAt",
        jsonb_build_object('id',pr.id,'displayName',pr."displayName",'avatarUrl',pr."avatarUrl") AS provider,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('providerService',jsonb_build_object(
          'id',ps.id,'priceAmount',ps."priceAmount",'durationMinutes',ps."durationMinutes",'status',ps.status,
          'service',jsonb_build_object('id',s.id,'name',s.name,'categoryId',s."categoryId",'categorySlug',cat.slug))))
          FROM feed_post_services link JOIN provider_services ps ON ps.id=link."providerServiceId"
          JOIN services s ON s.id=ps."serviceId" JOIN service_categories cat ON cat.id=s."categoryId"
          WHERE link."postId"=p.id AND ps.status='ACTIVE' AND s.status='ACTIVE' AND cat.status='ACTIVE'), '[]'::jsonb) AS services,
        jsonb_build_object(
          'likes',(SELECT COUNT(*) FROM feed_likes WHERE "postId"=p.id),
          'comments',(SELECT COUNT(*) FROM feed_comments WHERE "postId"=p.id),
          'saves',(SELECT COUNT(*) FROM feed_saves WHERE "postId"=p.id)) AS "_count"
      FROM feed_posts p JOIN provider_profiles pr ON pr.id=p."providerId" JOIN users u ON u.id=pr."userId"
      WHERE p.id IN (${Prisma.join(ids)}) AND p.status='PUBLISHED'
        AND p."moderationStatus"='APPROVED'
        AND (p."organizationReviewStatus" IS NULL OR p."organizationReviewStatus"='APPROVED')
        AND pr.status='ACTIVE' AND u.status='ACTIVE'
    `);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }
}
