import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WalletService } from '../application/wallet.service';
import { SePayIpnDto } from '../dto/sepay-ipn.dto';

@ApiTags('Payment Webhooks')
@Controller('payments/sepay')
export class SePayWebhookController {
  constructor(private readonly wallet: WalletService) {}

  @Post('ipn')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async ipn(
    @Headers('x-secret-key') secretKey: string | undefined,
    @Body() payload: SePayIpnDto,
  ): Promise<{ success: true }> {
    await this.wallet.processSePayIpn(secretKey, payload);
    return { success: true };
  }

  @Get('checkout/:id')
  @ApiExcludeEndpoint()
  async checkout(@Param('id') id: string, @Res() response: Response) {
    const page = await this.wallet.getSePayCheckoutPage(id);
    response
      .status(HttpStatus.OK)
      .setHeader('content-type', 'text/html; charset=utf-8')
      .setHeader('cache-control', 'no-store')
      .setHeader('content-security-policy', page.contentSecurityPolicy)
      .send(page.html);
  }

  @Get(':result')
  @Header('cache-control', 'no-store')
  @ApiOperation({ summary: 'Trang redirect kết quả thanh toán SePay' })
  paymentReturn(
    @Param('result') result: string,
    @Query('topUpId') topUpId?: string,
  ) {
    if (!['success', 'error', 'cancel'].includes(result)) {
      throw new NotFoundException('Không tìm thấy trang kết quả SePay.');
    }
    return {
      success: true,
      message:
        'SePay đã chuyển hướng về Lambe. Ứng dụng cần tải lại trạng thái nạp tiền.',
      data: { result, topUpId },
    };
  }
}
