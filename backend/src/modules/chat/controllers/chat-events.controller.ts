import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiRateLimitError,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ChatQueryService } from '../application/chat-query.service';
import { ChatEventsQueryDto, ChatIdParamDto } from '../dto/chat.dto';

const PAGE_SIZE = 100;
const MAX_MESSAGES_PER_STREAM = 1_000;
const STREAM_LIFETIME_MS = 30_000;
const MAX_STREAMS_PER_USER = 3;

@ApiTags('Customer Provider Chat')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/conversations')
export class ChatEventsController {
  private readonly activeStreams = new Map<string, number>();

  constructor(
    private readonly queries: ChatQueryService,
    private readonly cache: RedisCacheService,
  ) {}

  @Get(':id/events')
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Theo dõi tin nhắn mới qua SSE trong tối đa 30 giây',
    description:
      'Gửi event message theo sequence tăng dần. Truyền afterSequence khi kết nối lại; client cũng có thể dùng GET /messages để đồng bộ khi mất mạng. Redis lỗi thì stream tự kiểm tra PostgreSQL mỗi 5 giây.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'Luồng SSE message theo thứ tự sequence tăng dần.',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'id: 12\nevent: message\ndata: {"id":"uuid","sequence":12,"kind":"TEXT"}\n\n',
        },
      },
    },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hội thoại')
  @ApiRateLimitError()
  @ApiValidationError()
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ChatIdParamDto,
    @Query() query: ChatEventsQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.queries.assertAccess(user.userId, params.id);
    const count = this.activeStreams.get(user.userId) ?? 0;
    if (count >= MAX_STREAMS_PER_USER) {
      throw new HttpException(
        'Đã mở quá nhiều kết nối chat.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeStreams.set(user.userId, count + 1);

    let after = query.afterSequence ?? 0;
    let emitted = 0;
    let ready = false;
    let refreshing = false;
    let pending = false;
    let closed = false;
    let poll: NodeJS.Timeout | undefined;
    let timeout: NodeJS.Timeout | undefined;
    let unsubscribe: () => Promise<void> = () => Promise.resolve();
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (poll) clearInterval(poll);
      if (timeout) clearTimeout(timeout);
      const current = this.activeStreams.get(user.userId) ?? 1;
      if (current <= 1) this.activeStreams.delete(user.userId);
      else this.activeStreams.set(user.userId, current - 1);
      void unsubscribe().catch(() => undefined);
    };
    response.once('close', cleanup);

    const refresh = async () => {
      if (closed || response.destroyed || response.writableEnded) return;
      if (!ready || refreshing) {
        pending = true;
        return;
      }
      refreshing = true;
      try {
        do {
          pending = false;
          const page = await this.queries.messages(user.userId, params.id, {
            afterSequence: after,
            limit: PAGE_SIZE,
          });
          if (closed || response.destroyed || response.writableEnded) return;
          for (const message of page.data) {
            after = message.sequence;
            const writable = response.write(
              `id: ${message.sequence}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`,
            );
            emitted++;
            if (!writable || emitted >= MAX_MESSAGES_PER_STREAM) {
              response.end();
              return;
            }
          }
          if (page.data.length === PAGE_SIZE) pending = true;
        } while (pending);
      } catch {
        response.end();
      } finally {
        refreshing = false;
        if (pending && !closed) void refresh();
      }
    };

    try {
      // Subscribe first; the database read below closes the subscribe/read gap.
      try {
        unsubscribe = await this.cache.subscribeChatUpdates(params.id, () => {
          void refresh();
        });
      } catch {
        // PostgreSQL polling below remains available when Redis is down.
      }
      if (closed) {
        await unsubscribe();
        return;
      }
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();
      ready = true;
      await refresh();
      if (closed || response.writableEnded) return;
      poll = setInterval(() => void refresh(), 5_000);
      timeout = setTimeout(() => response.end(), STREAM_LIFETIME_MS);
    } catch (error) {
      cleanup();
      throw error;
    }
  }
}
