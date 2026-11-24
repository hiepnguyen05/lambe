import { Module } from '@nestjs/common';
import { ObservabilityMetricsModule } from '../../infrastructure/observability/observability-metrics.module';
import { ProviderMembersModule } from '../provider-members/provider-members.module';
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
import { OrderRescheduleService } from './application/scheduling/order-reschedule.service';
import { OrderBookingService } from './application/booking/order-booking.service';
import { OrderWalletService } from './application/payments/order-wallet.service';
import { OrderPaymentDisputeService } from './application/payments/order-payment-dispute.service';
import { SupportPaymentDisputesController } from './controllers/support-payment-disputes.controller';
import { UploadModule } from '../upload/upload.module';
import { OrderEvidenceService } from './application/evidence/order-evidence.service';
import { OrderEvidenceController } from './controllers/order-evidence.controller';
import { OrderCancellationService } from './application/cancellation/order-cancellation.service';
import { SupportOrderCancellationsController } from './controllers/support-order-cancellations.controller';
import { OrderReviewService } from './application/reviews/order-review.service';
import { ProviderReviewsController } from './controllers/provider-reviews.controller';
import { OrderNotificationsService } from './application/notifications/order-notifications.service';
import { OrderNotificationRelayService } from './application/notifications/order-notification-relay.service';
import { OrderNotificationsController } from './controllers/order-notifications.controller';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { AdminOrderQueryService } from './application/operations/admin-order-query.service';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { VoucherService } from './application/pricing/voucher.service';
import {
  AdminVouchersController,
  CustomerVouchersController,
  ProviderVouchersController,
} from './controllers/vouchers.controller';
import {
  CustomerOrderTrackingController,
  ProviderOrderTrackingController,
} from './controllers/order-tracking.controller';
import { OrderTrackingService } from './application/tracking/order-tracking.service';
import { OsrmRoutingService } from './application/tracking/osrm-routing.service';
import { OrderSafetyService } from './application/safety/order-safety.service';
import { OrderSafetyEvidenceService } from './application/safety/order-safety-evidence.service';
import { OrderSafetyController } from './controllers/order-safety.controller';
import { SupportOrderSafetyController } from './controllers/support-order-safety.controller';
import { OrderAddOnsService } from './application/add-ons/order-add-ons.service';
import { OrderAddOnsController } from './controllers/order-add-ons.controller';
import { OrderOperationalAlertService } from './application/operations/order-operational-alert.service';
import { SupportOrderOperationalAlertsController } from './controllers/support-order-operational-alerts.controller';
import { MailModule } from '../../infrastructure/mail/mail.module';

@Module({
  imports: [
    ObservabilityMetricsModule,
    PostgresModule,
    CacheModule,
    AuditModule,
    AuthModule,
    ChatModule,
    InternalAuthModule,
    UploadModule,
    ProviderMembersModule,
    MailModule,
  ],
  controllers: [
    CustomerOrdersController,
    ProviderOrdersController,
    BookingCalendarController,
    OrderEvidenceController,
    SupportOrderCancellationsController,
    SupportPaymentDisputesController,
    ProviderReviewsController,
    OrderNotificationsController,
    SupportOrderOperationalAlertsController,
    AdminOrdersController,
    AdminVouchersController,
    CustomerVouchersController,
    ProviderVouchersController,
    CustomerOrderTrackingController,
    ProviderOrderTrackingController,
    OrderSafetyController,
    SupportOrderSafetyController,
    OrderAddOnsController,
  ],
  providers: [
    OrderEligibilityService,
    OrdersService,
    BookingCalendarService,
    BookingAvailabilityService,
    OrderRescheduleService,
    OrderBookingService,
    OrderWalletService,
    OrderPaymentDisputeService,
    OrderEvidenceService,
    OrderCancellationService,
    OrderReviewService,
    OrderNotificationsService,
    OrderNotificationRelayService,
    AdminOrderQueryService,
    VoucherService,
    OrderTrackingService,
    OsrmRoutingService,
    OrderSafetyService,
    OrderSafetyEvidenceService,
    OrderAddOnsService,
    OrderOperationalAlertService,
  ],
  exports: [
    OrderReviewService,
    BookingCalendarService,
    OrderEligibilityService,
    OrderBookingService,
  ],
})
export class OrdersModule {}
