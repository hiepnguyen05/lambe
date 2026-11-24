import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiNotFoundError,
  ApiRateLimitError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { aiConsultationResultExample } from '../dto/ai-consultation.examples';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AiConsultationService } from '../application/ai-consultation.service';
import { AiFeedbackService } from '../application/ai-feedback.service';
import {
  ConsultationMessageDto,
  ConsultationActionDto,
  ConversationParamDto,
  ConsultationRecommendationParamDto,
  AiFeedbackDto,
} from '../dto/ai-consultation.dto';

@ApiTags('AI Consultation')
@ApiBearerAuth('user-token')
@ApiAuthenticationErrors()
@UseGuards(JwtAuthGuard)
@Controller('me/ai-conversations')
export class AiConsultationController {
  constructor(
    private readonly consultation: AiConsultationService,
    private readonly feedback: AiFeedbackService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Mở phiên tư vấn làm đẹp' })
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.consultation.create(user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Liệt kê phiên tư vấn của mình' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.consultation.list(user.userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Lấy 50 tin nhắn gần nhất' })
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ConversationParamDto,
  ) {
    return this.consultation.messages(user.userId, param.id);
  }

  @Post(':id/messages')
  @HttpCode(200)
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Hỏi trợ lý và nhận gợi ý tư vấn' })
  @ApiStandardOk({
    description:
      'Tư vấn, mẫu công khai và hành động tiếp theo. nextAction có thể yêu cầu địa chỉ/thời gian trước khi tìm thợ.',
    data: aiConsultationResultExample,
  })
  @ApiValidationError()
  @ApiNotFoundError('Hội thoại')
  @ApiConflictError(
    'Tin nhắn đang xử lý hoặc clientMessageId đã được dùng cho nội dung khác.',
  )
  @ApiRateLimitError()
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ConversationParamDto,
    @Body() dto: ConsultationMessageDto,
  ) {
    return this.consultation.send(user.userId, param.id, dto);
  }

  @Get(':id/messages/:clientMessageId/recommendations')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Kiểm tra lại gợi ý trước khi mở card cũ',
    description:
      'Chỉ đọc dữ liệu Lambe hiện tại; không gọi Gemini, không giữ lịch. Loại dịch vụ/đối tác/bài không còn khả dụng, cập nhật khung giá và giá dịch vụ. Availability/khoảng cách vẫn là snapshot, quote và Discovery phải kiểm tra lại.',
  })
  @ApiStandardOk({
    description:
      'Phản hồi được chiếu lại theo trạng thái hiện tại; suggestionsExpired=true nếu nội dung card thay đổi.',
    data: { ...aiConsultationResultExample, suggestionsExpired: true },
  })
  @ApiValidationError()
  @ApiNotFoundError('Hội thoại hoặc tin nhắn')
  @ApiConflictError('Tin nhắn chưa có kết quả')
  @ApiRateLimitError()
  refreshRecommendations(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ConsultationRecommendationParamDto,
  ) {
    return this.consultation.refreshRecommendations(
      user.userId,
      param.id,
      param.clientMessageId,
    );
  }

  @Post(':id/actions')
  @HttpCode(200)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ghi nhận khách chọn một gợi ý của trợ lý' })
  @ApiStandardOk({
    description:
      'Đã ghi nhận hành động có trong phản hồi thuộc hội thoại của mình.',
    data: { recorded: true },
  })
  @ApiValidationError()
  @ApiNotFoundError('Hội thoại')
  @ApiRateLimitError()
  recordAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ConversationParamDto,
    @Body() dto: ConsultationActionDto,
  ) {
    return this.consultation.recordAction(user.userId, param.id, dto);
  }

  @Post(':id/messages/:clientMessageId/feedback')
  @HttpCode(200)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đánh giá câu trả lời tư vấn của chính mình' })
  recordFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ConsultationRecommendationParamDto,
    @Body() dto: AiFeedbackDto,
  ) {
    return this.feedback.record(
      user.userId,
      param.id,
      param.clientMessageId,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa phiên tư vấn và lịch sử của mình' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: ConversationParamDto,
  ) {
    return this.consultation.remove(user.userId, param.id);
  }
}
