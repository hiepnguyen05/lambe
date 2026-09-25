import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../common/http/types/request-metadata.type';
import { PrismaService } from '../persistence/postgres/prisma.service';
import type { AuditEvent } from './audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    event: AuditEvent,
    request: RequestMetadata = {},
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;

    await client.auditLog.create({
      data: {
        ...event,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        requestId: request.requestId,
      },
    });
  }
}
