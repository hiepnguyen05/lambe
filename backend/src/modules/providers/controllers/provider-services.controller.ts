import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderServicesService } from '../application/services/provider-services.service';
import { UpdateProviderServiceAvailabilityDto } from '../dto/provider-service-management.dto';

@ApiTags('Provider Services')
@ApiBearerAuth('user-token')
@Controller('me/provider/services')
@UseGuards(JwtAuthGuard)
export class ProviderServicesController {
  constructor(private readonly services: ProviderServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách dịch vụ đã được duyệt của đối tác' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.services.listMine(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một dịch vụ của đối tác' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.services.findMine(user.userId, id);
  }

  @Put(':id/availability')
  @ApiOperation({ summary: 'Bật hoặc tạm ngừng nhận đơn mới cho một dịch vụ' })
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProviderServiceAvailabilityDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.services.setAvailability(user.userId, id, dto.active, request);
  }
}
