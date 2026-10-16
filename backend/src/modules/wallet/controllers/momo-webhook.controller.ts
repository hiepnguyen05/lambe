import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletService } from '../application/wallet.service';
import { MomoIpnDto } from '../dto/momo-ipn.dto';

@ApiTags('Payment Webhooks')
@Controller('payments/momo')
export class MomoWebhookController {
  constructor(private readonly wallet: WalletService) {}

  @Post('ipn')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  async ipn(@Body() payload: MomoIpnDto): Promise<void> {
    await this.wallet.processMomoIpn(payload);
  }

  @Get('return')
  @ApiOperation({ summary: 'Trang kết quả redirect từ MoMo sandbox' })
  paymentReturn(
    @Query('orderId') orderId?: string,
    @Query('resultCode') resultCode?: string,
    @Query('message') message?: string,
  ) {
    return {
      success: true,
      message:
        'MoMo đã chuyển hướng về Lambe. Ứng dụng cần tải lại trạng thái nạp tiền.',
      data: { orderId, resultCode, message },
    };
  }
}
