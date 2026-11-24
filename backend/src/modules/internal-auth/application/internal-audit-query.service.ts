import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { InternalAuditQueryDto } from '../dto/internal-audit-query.dto';

const auditSelect = {
  id: true,
  actorInternalAccountId: true,
  actorUserId: true,
  action: true,
  resourceType: true,
  resourceId: true,
  result: true,
  requestId: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class InternalAuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: InternalAuditQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException('Khoang thoi gian khong hop le.');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.AuditLogWhereInput = {
      actorInternalAccountId: query.actorInternalAccountId,
      action: query.action,
      resourceType: query.resourceType,
      result: query.result,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: auditSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      success: true,
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      select: auditSelect,
    });
    if (!row) throw new NotFoundException('Khong tim thay nhat ky thao tac.');
    return { success: true, data: row };
  }
}
