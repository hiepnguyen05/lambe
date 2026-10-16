import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderReviewService } from '../application/reviews/order-review.service';
import { OrderParamDto } from '../dto/order.dto';

@ApiTags('Provider Reviews')
@Controller('providers')
export class ProviderReviewsController {
  constructor(private readonly reviews: OrderReviewService) {}

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Điểm trung bình và 20 đánh giá gần nhất của thợ' })
  get(@Param() params: OrderParamDto) {
    return this.reviews.findForProvider(params.id);
  }
}
