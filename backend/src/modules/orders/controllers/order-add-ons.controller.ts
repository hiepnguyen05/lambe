import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiNotFoundError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderAddOnsService } from '../application/add-ons/order-add-ons.service';
import {
  CreateOrderAddOnDto,
  DecideOrderAddOnDto,
  OrderAddOnDecisionParamDto,
  OrderAddOnParamDto,
} from '../dto/order-add-on.dto';

@ApiTags('Order Add-ons')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class OrderAddOnsController {
  constructor(private readonly addOns: OrderAddOnsService) {}

  @Get('me/provider/orders/:id/add-on-options')
  @ApiOperation({ summary: 'Liệt kê dịch vụ phát sinh thợ có thể đề nghị' })
  @ApiStandardOk({
    description: 'Giá và giờ kết thúc dự kiến tại thời điểm đọc.',
    data: [],
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Đơn của thợ')
  options(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderAddOnParamDto,
  ) {
    return this.addOns.options(user.userId, params.id);
  }

  @Post('me/provider/orders/:id/add-ons')
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description:
      '8-128 ký tự chữ, số, _ hoặc -; retry dùng lại cùng key và nội dung.',
  })
  @ApiOperation({
    summary: 'Thợ đề nghị thêm một dịch vụ vào đơn đang thực hiện',
  })
  @ApiStandardCreated({
    description: 'Chờ khách chấp nhận; giá đơn chưa thay đổi.',
    data: { status: 'PENDING' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Dịch vụ/lịch/ví không hợp lệ hoặc đã có đề nghị đang chờ.')
  @ApiNotFoundError('Đơn của thợ')
  propose(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderAddOnParamDto,
    @Body() dto: CreateOrderAddOnDto,
    @Headers('idempotency-key') key: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.addOns.propose(user.userId, params.id, dto, key, metadata);
  }

  @Post('me/provider/orders/:id/add-ons/:addOnId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Thợ rút lại đề nghị chưa được khách xử lý' })
  @ApiStandardOk({
    description: 'Đề nghị đã hủy.',
    data: { status: 'CANCELLED' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Đơn hoặc đề nghị của thợ')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderAddOnDecisionParamDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.addOns.cancel(user.userId, params.id, params.addOnId, metadata);
  }

  @Post('me/orders/:id/add-ons/:addOnId/decision')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Khách chấp nhận hoặc từ chối dịch vụ phát sinh và giá mới',
  })
  @ApiStandardOk({
    description:
      'Chỉ khi chấp nhận mới tăng tổng tiền, lịch và hoa hồng giữ trong ví.',
    data: { status: 'ACCEPTED' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Đề nghị hết hạn hoặc lịch/giá/ví đã thay đổi.')
  @ApiNotFoundError('Đơn hoặc đề nghị của khách')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderAddOnDecisionParamDto,
    @Body() dto: DecideOrderAddOnDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.addOns.decide(
      user.userId,
      params.id,
      params.addOnId,
      dto,
      metadata,
    );
  }
}
