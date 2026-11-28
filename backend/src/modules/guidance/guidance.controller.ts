import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { GuidanceTourParamDto, SaveGuidanceDto } from './guidance.dto';
import { GuidanceService } from './guidance.service';

@ApiTags('Guidance')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/guidance')
export class GuidanceController {
  constructor(private readonly guidance: GuidanceService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.guidance.list(user.userId);
  }

  @Put(':tourId')
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: GuidanceTourParamDto,
    @Body() dto: SaveGuidanceDto,
  ) {
    return this.guidance.save(user.userId, params.tourId, dto);
  }
}
