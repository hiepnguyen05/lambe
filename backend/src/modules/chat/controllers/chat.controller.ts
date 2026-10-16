import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ChatService } from '../application/chat.service';
import { ChatQueryService } from '../application/chat-query.service';
import { ChatModerationService } from '../application/chat-moderation.service';
import {
  ChatIdParamDto,
  ChatMessagesQueryDto,
  InboxQueryDto,
  MarkChatReadDto,
  ReportChatDto,
  SendChatMessageDto,
  StartChatDto,
} from '../dto/chat.dto';

@ApiTags('Customer Provider Chat')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/conversations')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly queries: ChatQueryService,
    private readonly moderation: ChatModerationService,
  ) {}

  @Post()
  @HttpCode(200)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Khách gửi tin đầu tiên và mở hội thoại với thợ' })
  @ApiStandardOk({
    description: 'Tin nhắn được lưu; retry cùng ID không tạo trùng.',
    data: { conversationId: 'uuid', message: { id: 'uuid', sequence: 1 } },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartChatDto) {
    return this.chat.start(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách hội thoại ở vai trò khách hoặc thợ' })
  @ApiStandardOk({ description: 'Inbox phân trang.', data: [] })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  inbox(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxQueryDto) {
    return this.queries.inbox(user.userId, query);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Lấy tin nhắn cũ hoặc đồng bộ tin mới theo sequence',
  })
  @ApiStandardOk({ description: 'Tin nhắn phân trang.', data: [] })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hội thoại')
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ChatIdParamDto,
    @Query() query: ChatMessagesQueryDto,
  ) {
    return this.queries.messages(user.userId, param.id, query);
  }

  @Post(':id/messages')
  @HttpCode(200)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi text hoặc thẻ dịch vụ trong hội thoại' })
  @ApiStandardOk({
    description: 'Tin nhắn được lưu.',
    data: { conversationId: 'uuid', message: { id: 'uuid', sequence: 2 } },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hội thoại')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ChatIdParamDto,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chat.send(user.userId, param.id, dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc đến sequence chỉ định' })
  @ApiStandardOk({
    description: 'Vị trí đã đọc hiện tại.',
    data: { lastReadSequence: 2 },
  })
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ChatIdParamDto,
    @Body() dto: MarkChatReadDto,
  ) {
    return this.queries.markRead(user.userId, param.id, dto.lastReadSequence);
  }

  @Put(':id/block')
  @ApiOperation({ summary: 'Chặn hội thoại' })
  @ApiStandardOk({ description: 'Đã chặn.', data: { blockedByMe: true } })
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ChatIdParamDto,
  ) {
    return this.moderation.block(user.userId, param.id, true);
  }

  @Delete(':id/block')
  @ApiOperation({ summary: 'Bỏ chặn hội thoại' })
  @ApiStandardOk({ description: 'Đã bỏ chặn.', data: { blockedByMe: false } })
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ChatIdParamDto,
  ) {
    return this.moderation.block(user.userId, param.id, false);
  }

  @Post(':id/reports')
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Báo cáo nội dung chat vi phạm' })
  @ApiStandardOk({ description: 'Đã ghi nhận báo cáo.', data: { id: 'uuid' } })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ChatIdParamDto,
    @Body() dto: ReportChatDto,
  ) {
    return this.moderation.report(user.userId, param.id, dto);
  }
}
