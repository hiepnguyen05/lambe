import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { FeedRecommendationService } from '../application/feed-recommendation.service';
import { FeedEngagementDto } from '../dto/feed-engagement.dto';
import { FeedIdParamDto } from '../dto/feed.dto';

@ApiTags('Feed recommendations')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/feed')
export class FeedRecommendationController {
  constructor(private readonly service: FeedRecommendationService) {}
  @Get('recommended')
  @ApiOperation({
    summary:
      'Gợi ý thử nghiệm theo quy tắc; cần bật FEED_RECOMMENDATIONS_ENABLED',
  })
  recommend(@CurrentUser() user: AuthenticatedUser) {
    return this.service.recommend(user.userId);
  }

  @Post('posts/:id/engagements')
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Ghi nhận hành vi Feed theo tài khoản và clientEventId chống trùng',
  })
  engage(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: FeedEngagementDto,
  ) {
    return this.service.engage(user.userId, param.id, dto);
  }
}
