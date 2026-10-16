import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { OrderEligibilityService } from './application/order-eligibility.service';
import { OrdersService } from './application/orders.service';
import { CustomerOrdersController } from './controllers/customer-orders.controller';
import { ProviderOrdersController } from './controllers/provider-orders.controller';
import { BookingCalendarController } from './controllers/booking-calendar.controller';
import { BookingCalendarService } from './application/scheduling/booking-calendar.service';
import { BookingAvailabilityService } from './application/scheduling/booking-availability.service';
import { OrderBookingService } from './application/booking/order-booking.service';
import { OrderWalletService } from './application/payments/order-wallet.service';
import { UploadModule } from '../upload/upload.module';
import { OrderEvidenceService } from './application/evidence/order-evidence.service';
import { OrderEvidenceController } from './controllers/order-evidence.controller';
import { OrderCancellationService } from './application/cancellation/order-cancellation.service';
import { SupportOrderCancellationsController } from './controllers/support-order-cancellations.controller';
import { OrderReviewService } from './application/reviews/order-review.service';
import { ProviderReviewsController } from './controllers/provider-reviews.controller';
import { OrderNotificationsService } from './application/notifications/order-notifications.service';
import { OrderNotificationsController } from './controllers/order-notifications.controller';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';

@Module({
  imports: [
    PostgresModule,
    CacheModule,
    AuditModule,
    AuthModule,
    ChatModule,
    InternalAuthModule,
    UploadModule,
  ],
  controllers: [
    CustomerOrdersController,
    ProviderOrdersController,
    BookingCalendarController,
    OrderEvidenceController,
    SupportOrderCancellationsController,
    ProviderReviewsController,
    OrderNotificationsController,
  ],
  providers: [
    OrderEligibilityService,
    OrdersService,
    BookingCalendarService,
    BookingAvailabilityService,
    OrderBookingService,
    OrderWalletService,
    OrderEvidenceService,
    OrderCancellationService,
    OrderReviewService,
    OrderNotificationsService,
  ],
  exports: [BookingCalendarService, OrderEligibilityService],
})
export class OrdersModule {}
