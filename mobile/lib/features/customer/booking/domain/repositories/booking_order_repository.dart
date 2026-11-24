import '../entities/booking_draft_entity.dart';
import '../entities/booking_submission_entity.dart';
import '../entities/order_quote_entity.dart';
import '../entities/voucher_entity.dart';

abstract class BookingOrderRepository {
  Future<List<VoucherEntity>> getEligibleVouchers(String providerServiceId);

  Future<OrderQuoteEntity> getQuote({
    required BookingDraftEntity draft,
    String? voucherCode,
  });

  Future<BookingSubmissionEntity> submitOrder({
    required BookingDraftEntity draft,
    required String contactName,
    required String contactPhone,
    required String customerNote,
    required String quoteToken,
    String? voucherCode,
  });
}
