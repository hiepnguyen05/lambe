import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { CreateOrderReviewDto } from '../../dto/order.dto';
import type { ProviderReviewQueryDto } from '../../dto/provider-review-query.dto';
import {
  presentReview,
  publicReviewSelect,
  type ReviewSummary,
} from './order-review.presenter';

@Injectable()
export class OrderReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    customerId: string,
    orderId: string,
    dto: CreateOrderReviewDto,
    metadata: RequestMetadata,
  ) {
    const review = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} AND "customerId" = ${customerId} FOR UPDATE`,
      );
      const order = await tx.serviceOrder.findFirst({
        where: { id: orderId, customerId },
        select: {
          providerId: true,
          assignedMemberId: true,
          assignedMemberVersion: true,
          assignedMemberName: true,
          assignedMemberAvatarUrl: true,
          status: true,
          review: { select: { id: true } },
        },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      if (order.status !== ServiceOrderStatus.COMPLETED)
        throw new ConflictException('Chỉ có thể đánh giá đơn đã hoàn thành.');
      if (order.review) throw new ConflictException('Đơn đã được đánh giá.');
      const created = await tx.orderReview.create({
        data: {
          orderId,
          customerId,
          providerId: order.providerId,
          memberId: order.assignedMemberId,
          membershipVersion: order.assignedMemberVersion,
          memberDisplayName: order.assignedMemberName,
          memberAvatarUrl: order.assignedMemberAvatarUrl,
          rating: dto.rating,
          comment: dto.comment,
        },
        select: publicReviewSelect,
      });
      await this.audit.record(
        {
          actorUserId: customerId,
          action: 'ORDER_REVIEW_CREATED',
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return created;
    });
    return { success: true, data: presentReview(review) };
  }

  async findForProvider(
    providerId: string,
    query: ProviderReviewQueryDto = {},
  ) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('Không tìm thấy thợ.');
    return this.findReviews({ providerId }, query);
  }

  async findForMember(
    providerId: string,
    memberId: string,
    query: ProviderReviewQueryDto,
  ) {
    const member = await this.prisma.providerMember.findFirst({
      where: {
        id: memberId,
        providerId,
        provider: { providerType: 'ORGANIZATION' },
      },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Không tìm thấy chuyên viên.');
    return this.findReviews({ providerId, memberId }, query);
  }

  async providerSummaries(providerIds: readonly string[]) {
    const uniqueIds = [...new Set(providerIds)];
    const summaries = new Map<string, ReviewSummary>(
      uniqueIds.map((id) => [id, { count: 0, averageRating: null }]),
    );
    if (uniqueIds.length === 0) return summaries;
    const groups = await this.prisma.orderReview.groupBy({
      by: ['providerId'],
      where: { providerId: { in: uniqueIds } },
      _count: { id: true },
      _avg: { rating: true },
    });
    for (const group of groups) {
      summaries.set(group.providerId, {
        count: group._count.id,
        averageRating: group._avg.rating,
      });
    }
    return summaries;
  }

  async memberSummaries(memberIds: readonly string[]) {
    const uniqueIds = [...new Set(memberIds)];
    const summaries = new Map<string, ReviewSummary>(
      uniqueIds.map((id) => [id, { count: 0, averageRating: null }]),
    );
    if (uniqueIds.length === 0) return summaries;
    const groups = await this.prisma.orderReview.groupBy({
      by: ['memberId'],
      where: { memberId: { in: uniqueIds } },
      _count: { id: true },
      _avg: { rating: true },
    });
    for (const group of groups) {
      if (group.memberId)
        summaries.set(group.memberId, {
          count: group._count.id,
          averageRating: group._avg.rating,
        });
    }
    return summaries;
  }

  private async findReviews(
    where: Prisma.OrderReviewWhereInput,
    query: ProviderReviewQueryDto,
  ) {
    const cursor = query.cursor
      ? await this.prisma.orderReview.findFirst({
          where: { AND: [where, { id: query.cursor }] },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.cursor && !cursor)
      throw new BadRequestException('Con trỏ đánh giá không hợp lệ.');
    const limit = query.limit ?? 20;
    const [summary, reviews] = await this.prisma.$transaction(
      [
        this.prisma.orderReview.aggregate({
          where,
          _count: { id: true },
          _avg: { rating: true },
        }),
        this.prisma.orderReview.findMany({
          where: cursor
            ? {
                AND: [
                  where,
                  {
                    OR: [
                      { createdAt: { lt: cursor.createdAt } },
                      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                    ],
                  },
                ],
              }
            : where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          select: publicReviewSelect,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      success: true,
      data: {
        count: summary._count.id,
        averageRating: summary._avg.rating,
        reviews: reviews.slice(0, limit).map(presentReview),
        nextCursor: reviews.length > limit ? reviews[limit - 1].id : null,
      },
    };
  }
}
