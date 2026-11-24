import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OrderReviewService } from '../application/reviews/order-review.service';
import { OrderParamDto } from '../dto/order.dto';
import { ProviderReviewQueryDto } from '../dto/provider-review-query.dto';
import {
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';

const reviewPageExample = {
  count: 1,
  averageRating: 5,
  reviews: [
    {
      id: '1f52d81e-6977-4818-a4f6-d160f8245358',
      rating: 5,
      comment: 'Chuyên viên làm việc cẩn thận.',
      createdAt: '2026-10-29T05:00:00.000Z',
      assignedMember: {
        id: '216a1b81-4061-42be-b08a-3497522fb430',
        displayName: 'Nguyễn Văn An',
        avatarUrl: null,
      },
    },
  ],
  nextCursor: null,
};

@ApiTags('Provider Reviews')
@Controller('providers')
export class ProviderReviewsController {
  constructor(private readonly reviews: OrderReviewService) {}

  @Get(':id/reviews')
  @ApiOperation({
    summary: 'Đánh giá công khai của đối tác cá nhân hoặc tổ chức',
    description:
      'Mỗi đơn đóng góp một đánh giá. Tổng hợp toàn bộ lịch sử, không chỉ trang hiện tại. averageRating=null khi chưa có; assignedMember=null với đơn cá nhân hoặc đơn cũ chưa phân công. Phân trang (createdAt, id) giảm dần.',
  })
  @ApiStandardOk({
    description:
      'Tổng hợp điểm và trang đánh giá, không có thông tin riêng của khách.',
    data: reviewPageExample,
  })
  @ApiNotFoundError('Không tìm thấy đối tác.')
  @ApiValidationError()
  get(@Param() params: OrderParamDto, @Query() query: ProviderReviewQueryDto) {
    return this.reviews.findForProvider(params.id, query);
  }

  @Get(':providerId/members/:memberId/reviews')
  @ApiParam({ name: 'providerId', format: 'uuid', description: 'ID tổ chức.' })
  @ApiParam({
    name: 'memberId',
    format: 'uuid',
    description: 'ID chuyên viên thuộc tổ chức.',
  })
  @ApiOperation({
    summary: 'Đánh giá công khai của chuyên viên trong một tổ chức',
    description:
      'Chỉ đơn phân công cho member này, giữ cả các nhiệm kỳ cũ của cùng member. Không gán đánh giá legacy cho nhân viên hiện tại. Họ tên/ảnh trong từng đánh giá là snapshot của đơn. Lịch sử vẫn xem được khi nhân viên nghỉ; endpoint này không xác nhận khả năng nhận đơn.',
  })
  @ApiStandardOk({
    description: 'Điểm và trang đánh giá riêng của chuyên viên.',
    data: reviewPageExample,
  })
  @ApiNotFoundError('Không tìm thấy chuyên viên thuộc tổ chức này.')
  @ApiValidationError()
  member(
    @Param('providerId', new ParseUUIDPipe({ version: '4' }))
    providerId: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Query() query: ProviderReviewQueryDto,
  ) {
    return this.reviews.findForMember(providerId, memberId, query);
  }
}
