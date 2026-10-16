import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { WalletService } from '../application/wallet.service';
import {
  CreateMomoTopUpDto,
  WalletTopUpParamDto,
  WalletTopUpQueryDto,
  WalletTransactionQueryDto,
} from '../dto/wallet.dto';

@ApiTags('Provider Wallet')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/provider/wallet')
export class ProviderWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy số dư ví nhà cung cấp hiện tại' })
  @ApiStandardOk({
    description: 'Số dư tổng, đang giữ và khả dụng.',
    data: {
      balanceAmount: 200000,
      heldAmount: 15000,
      availableAmount: 185000,
      currencyCode: 'VND',
    },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Ví nhà cung cấp')
  getWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.getWallet(user.userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Lấy lịch sử giao dịch ví' })
  @ApiStandardOk({ description: 'Tối đa 50 giao dịch gần nhất.', data: [] })
  @ApiAuthenticationErrors()
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletTransactionQueryDto,
  ) {
    return this.wallet.getTransactions(user.userId, query);
  }

  @Post('top-ups/momo')
  @ApiOperation({ summary: 'Tạo yêu cầu nạp tiền bằng MoMo sandbox' })
  @ApiStandardCreated({
    description: 'Trả về payUrl/deeplink để chuyển người dùng sang MoMo.',
    message: 'Đã tạo yêu cầu nạp tiền MoMo.',
    data: {
      id: 'top-up-uuid',
      amount: 100000,
      status: 'PENDING_PAYMENT',
      payUrl: 'https://test-payment.momo.vn/...',
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  createMomoTopUp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMomoTopUpDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.wallet.createMomoTopUp(user.userId, dto, request);
  }

  @Post('top-ups/sepay')
  @ApiOperation({ summary: 'Tạo yêu cầu nạp tiền bằng SePay sandbox' })
  @ApiStandardCreated({
    description: 'Trả về payUrl để mở trang checkout SePay.',
    message: 'Đã tạo yêu cầu nạp tiền SePay.',
    data: {
      id: 'top-up-uuid',
      amount: 100000,
      status: 'PENDING_PAYMENT',
      payUrl: 'https://public-backend/api/payments/sepay/checkout/top-up-uuid',
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  createSePayTopUp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMomoTopUpDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.wallet.createSePayTopUp(user.userId, dto, request);
  }

  @Get('top-ups')
  @ApiOperation({ summary: 'Lấy lịch sử yêu cầu nạp tiền' })
  @ApiStandardOk({ description: 'Tối đa 50 yêu cầu gần nhất.', data: [] })
  @ApiAuthenticationErrors()
  getTopUps(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletTopUpQueryDto,
  ) {
    return this.wallet.getTopUps(user.userId, query);
  }

  @Get('top-ups/:id')
  @ApiOperation({ summary: 'Xem trạng thái một yêu cầu nạp tiền' })
  @ApiStandardOk({
    description: 'Trạng thái thanh toán đã ghi nhận từ IPN MoMo.',
    data: { id: 'top-up-uuid', status: 'SUCCEEDED', amount: 100000 },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Yêu cầu nạp tiền')
  getTopUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: WalletTopUpParamDto,
  ) {
    return this.wallet.getTopUp(user.userId, params.id);
  }
}
