import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { CreateOrderReviewDto } from '../../dto/order.dto';

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
          rating: dto.rating,
          comment: dto.comment,
        },
        select: { id: true, rating: true, comment: true, createdAt: true },
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
    return { success: true, data: review };
  }

  async findForProvider(providerId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('Không tìm thấy thợ.');
    const [summary, reviews] = await Promise.all([
      this.prisma.orderReview.aggregate({
        where: { providerId },
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.prisma.orderReview.findMany({
        where: { providerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
    ]);
    return {
      success: true,
      data: {
        count: summary._count.id,
        averageRating: summary._avg.rating,
        reviews,
      },
    };
  }
}
