import { Controller, Get, Header, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { FeedCacheWorkerService } from '../application/feed-cache-worker.service';
import { FeedCacheService } from '../application/feed-cache.service';
import { FeedQueryService } from '../application/feed-query.service';

@ApiTags('Feed cache operations')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
@Controller('internal/feed/cache')
export class FeedCacheOperationsController {
  constructor(
    private readonly worker: FeedCacheWorkerService,
    private readonly cache: FeedCacheService,
    private readonly queries: FeedQueryService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Đọc chỉ số cache và hàng đợi, chỉ Admin' })
  async status() {
    return { ...(await this.worker.status()), objects: this.cache.metrics };
  }

  @Post('rebuild')
  @ApiOperation({
    summary:
      'Đổi generation và dựng lại trang Feed đầu; các trang khác tự tái tạo khi đọc',
  })
  async rebuild(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    const state = await this.prisma.$transaction(async (tx) => {
      const state = await tx.feedCacheState.update({
        where: { id: 'global' },
        data: { version: { increment: 1 } },
      });
      await tx.feedCacheEvent.create({
        data: { sequence: state.version, eventType: 'CACHE_REBUILD' },
      });
      await this.audit.record(
        {
          actorInternalAccountId: account.accountId,
          action: 'FEED_CACHE_REBUILD',
          resourceType: 'FEED_CACHE',
          resourceId: 'global',
          result: 'SUCCESS',
        },
        {},
        tx,
      );
      return state;
    });
    await this.queries.list({ limit: 20 });
    return {
      generation: state.version.toString(),
      warmed: this.cache.isEnabled() ? 'global-first-page' : 'cache-disabled',
    };
  }
}
