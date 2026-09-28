import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CustomerRecommendationsService } from '../application/customer-recommendations.service';
import { RecommendationQueryDto } from '../dto/recommendation-query.dto';

@ApiTags('Customer Recommendations')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/recommendations')
export class CustomerRecommendationsController {
  constructor(
    private readonly recommendations: CustomerRecommendationsService,
  ) {}

  @Get('services')
  @ApiOperation({ summary: 'Lấy dịch vụ được xếp hạng theo sở thích khách' })
  getServices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ) {
    return this.recommendations.getServices(user.userId, query);
  }
}
