import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import type { ReviewOrganizationFeedPostDto } from '../../dto/feed.dto';
import { FeedAccessService } from './feed-access.service';
import { FeedQueryService } from '../feed-query.service';

@Injectable()
export class OrganizationFeedReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FeedAccessService,
    private readonly queries: FeedQueryService,
    private readonly audit: AuditService,
  ) {}

  async decide(
    userId: string,
    id: string,
    dto: ReviewOrganizationFeedPostDto,
    metadata: RequestMetadata,
  ) {
    if (dto.decision === 'REJECT' && (!dto.note || dto.note.trim().length < 5))
      throw new BadRequestException('Cần lý do từ chối ít nhất 5 ký tự.');
    await this.prisma.$transaction(async (tx) => {
      const { actor, candidate } = await this.access.forPost(tx, userId, id);
      if (actor.providerType !== 'ORGANIZATION' || actor.role !== 'OWNER')
        throw new ForbiddenException(
          'Chỉ owner của tổ chức được kiểm duyệt nội bộ.',
        );
      const author =
        dto.decision === 'APPROVE'
          ? await this.access.author(tx, candidate, actor)
          : null;
      const post = await this.access.lockPost(tx, id, actor);
      if (post.revisionNumber !== dto.revisionNumber)
        throw new ConflictException(
          'Bài đã có phiên bản mới, hãy đọc lại trước khi duyệt.',
        );
      const status =
        dto.decision === 'APPROVE'
          ? ('APPROVED' as const)
          : ('REJECTED' as const);
      if (post.organizationReviewStatus === status)
        throw new ConflictException('Bài đã có quyết định này.');
      if (author)
        await this.access.assertServices(
          author,
          post.services.map((s) => s.providerServiceId),
          tx,
        );
      await tx.feedPost.update({
        where: { id },
        data: {
          organizationReviewStatus: status,
          organizationReviewedByUserId: userId,
          organizationReviewedAt: new Date(),
          organizationReviewNote: dto.note ?? null,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'FEED_ORGANIZATION_REVIEWED',
          resourceType: 'FEED_POST',
          resourceId: id,
          result: 'SUCCESS',
          metadata: {
            note: dto.note ?? null,
            decision: dto.decision,
            revisionNumber: dto.revisionNumber,
          },
        },
        metadata,
        tx,
      );
    });
    return this.queries.ownedDetail(id, userId);
  }
}
