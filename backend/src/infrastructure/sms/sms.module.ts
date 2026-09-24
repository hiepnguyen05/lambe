import { Module } from '@nestjs/common';
import { SMS_SENDER } from './sms-sender';
import { SpeedSmsService } from './speedsms.service';

@Module({
  providers: [
    SpeedSmsService,
    {
      provide: SMS_SENDER,
      useExisting: SpeedSmsService,
    },
  ],
  exports: [SMS_SENDER],
})
export class SmsModule {}
