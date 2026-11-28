import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import { FeedCacheWorkerService } from '../application/feed-cache-worker.service';
import { FeedCacheService } from '../application/feed-cache.service';

@ApiTags('Feed cache operations')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
@Controller('internal/feed/cache')
export class FeedCacheOperationsController {
  constructor(
    private readonly worker: FeedCacheWorkerService,
    private readonly cache: FeedCacheService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Đọc chỉ số cache và hàng đợi, chỉ Admin' })
  async status() {
    return { ...(await this.worker.status()), objects: this.cache.metrics };
  }
}
