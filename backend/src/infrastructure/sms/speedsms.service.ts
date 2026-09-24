import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeVietnamesePhone } from '../../common/utils/phone.util';
import type { SmsSender } from './sms-sender';

interface SpeedSmsResponse {
  status: 'success' | 'error';
  code: string;
  message?: string;
  data?: {
    tranId: string | number;
    totalSMS: number;
    totalPrice: number;
    invalidPhone?: string[];
  };
}

const SPEEDSMS_ERROR_CODES: Record<string, string> = {
  '007': 'Địa chỉ IP đang bị khóa.',
  '008': 'Tài khoản SpeedSMS đang bị khóa.',
  '009': 'Tài khoản chưa được phép gọi API.',
  '101': 'Tham số gửi lên không hợp lệ hoặc còn thiếu.',
  '105': 'Số điện thoại không hợp lệ.',
  '110': 'Nội dung SMS sử dụng bảng mã không được hỗ trợ.',
  '113': 'Nội dung SMS vượt quá độ dài cho phép.',
  '300': 'Tài khoản SpeedSMS không đủ số dư.',
  '500': 'SpeedSMS đang gặp lỗi hệ thống.',
};

function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 3)}***${phone.slice(-3)}` : '***';
}

@Injectable()
export class SpeedSmsService implements SmsSender {
  private readonly logger = new Logger(SpeedSmsService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phone: string, otpCode: string): Promise<void> {
    const accessToken = this.configService.get<string>('speedsms.accessToken');
    const apiUrl = (
      this.configService.get<string>('speedsms.apiUrl') ||
      'https://api.speedsms.vn/index.php'
    ).replace(/\/$/, '');
    const smsType = this.configService.get<number>('speedsms.smsType') ?? 4;
    const sender = this.configService.get<string>('speedsms.sender') ?? '';
    const timeoutMs =
      this.configService.get<number>('speedsms.timeoutMs') ?? 10000;
    const nodeEnv =
      this.configService.get<string>('app.nodeEnv') || 'development';
    const normalizedPhone = normalizeVietnamesePhone(phone);
    const maskedPhone = maskPhone(normalizedPhone);
    const content = `Ma OTP Lambe cua ban la ${otpCode}. Ma co hieu luc trong 5 phut.`;

    if (
      !accessToken ||
      accessToken === 'YOUR_SPEEDSMS_ACCESS_TOKEN' ||
      accessToken.startsWith('CHANGE_ME')
    ) {
      if (nodeEnv === 'development' || nodeEnv === 'test') {
        this.logger.warn(
          `[DEV OTP cho ${maskedPhone}]: ${otpCode} (SpeedSMS chưa cấu hình)`,
        );
        return;
      }

      throw new InternalServerErrorException('Dịch vụ SMS chưa được cấu hình.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${apiUrl}/sms/send`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accessToken}:x`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [normalizedPhone],
          content,
          sms_type: smsType,
          sender,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `SpeedSMS HTTP ${response.status} ${response.statusText}`,
        );
      }

      const result = (await response.json()) as SpeedSmsResponse;

      if (result.status !== 'success' || result.code !== '00') {
        const description =
          SPEEDSMS_ERROR_CODES[result.code] ||
          result.message ||
          'Lỗi không xác định';
        throw new Error(`SpeedSMS code ${result.code}: ${description}`);
      }

      if (
        result.data?.invalidPhone?.some(
          (invalidPhone) =>
            normalizeVietnamesePhone(invalidPhone) === normalizedPhone,
        )
      ) {
        throw new Error('SpeedSMS từ chối số điện thoại người nhận.');
      }

      if (!result.data?.tranId) {
        throw new Error('SpeedSMS không trả về mã giao dịch.');
      }

      this.logger.log(
        `Đã gửi OTP tới ${maskedPhone} qua SpeedSMS. TranId: ${result.data.tranId}`,
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        isTimeout
          ? `SpeedSMS timeout sau ${timeoutMs}ms cho ${maskedPhone}`
          : `Không thể gửi OTP qua SpeedSMS: ${message}`,
        stack,
      );
      throw new InternalServerErrorException(
        'Không thể gửi mã OTP. Vui lòng thử lại sau.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
