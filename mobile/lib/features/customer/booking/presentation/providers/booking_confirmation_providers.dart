import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/booking_order_submission_service.dart';
import '../../domain/entities/booking_draft_entity.dart';
import '../../domain/entities/booking_submission_entity.dart';
import '../../domain/entities/order_quote_entity.dart';
import '../../domain/entities/voucher_entity.dart';
import '../../domain/repositories/booking_order_repository.dart';

/// Provider lấy danh sách voucher hợp lệ của chuyên viên (cho modal chọn voucher)
final eligibleVouchersProvider = FutureProvider.autoDispose
    .family<List<VoucherEntity>, String>((ref, providerServiceId) async {
      final repo = ref.watch(bookingOrderRepositoryProvider);
      return repo.getEligibleVouchers(providerServiceId);
    });

/// Trạng thái báo giá và gửi đơn đặt lịch
class BookingConfirmationState {
  final OrderQuoteEntity? quote;
  final bool isLoadingQuote;
  final String? quoteError;
  final String? selectedVoucherCode;
  final bool isSubmitting;
  final String? submitError;

  const BookingConfirmationState({
    this.quote,
    this.isLoadingQuote = false,
    this.quoteError,
    this.selectedVoucherCode,
    this.isSubmitting = false,
    this.submitError,
  });

  BookingConfirmationState copyWith({
    OrderQuoteEntity? Function()? quote,
    bool? isLoadingQuote,
    String? Function()? quoteError,
    String? Function()? selectedVoucherCode,
    bool? isSubmitting,
    String? Function()? submitError,
  }) {
    return BookingConfirmationState(
      quote: quote != null ? quote() : this.quote,
      isLoadingQuote: isLoadingQuote ?? this.isLoadingQuote,
      quoteError: quoteError != null ? quoteError() : this.quoteError,
      selectedVoucherCode: selectedVoucherCode != null
          ? selectedVoucherCode()
          : this.selectedVoucherCode,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: submitError != null ? submitError() : this.submitError,
    );
  }
}

/// Notifier quản lý quote và submit đơn đặt lịch
class BookingConfirmationNotifier
    extends StateNotifier<BookingConfirmationState> {
  final BookingOrderRepository _repository;

  BookingConfirmationNotifier(this._repository)
    : super(const BookingConfirmationState());

  void selectVoucher(String? voucherCode, BookingDraftEntity? draft) {
    state = state.copyWith(selectedVoucherCode: () => voucherCode);
    if (draft != null) {
      fetchQuote(draft, voucherCode: voucherCode);
    }
  }

  Future<void> fetchQuote(
    BookingDraftEntity draft, {
    String? voucherCode,
  }) async {
    state = state.copyWith(
      quote: () => null,
      isLoadingQuote: true,
      quoteError: () => null,
      selectedVoucherCode: () => voucherCode ?? state.selectedVoucherCode,
    );

    try {
      final quote = await _repository.getQuote(
        draft: draft,
        voucherCode: voucherCode ?? state.selectedVoucherCode,
      );
      state = state.copyWith(quote: () => quote, isLoadingQuote: false);
    } catch (e) {
      state = state.copyWith(
        quoteError: () => e.toString().replaceFirst('Exception: ', ''),
        isLoadingQuote: false,
      );
    }
  }

  Future<BookingSubmissionEntity?> submitOrder({
    required BookingDraftEntity draft,
    required String contactName,
    required String contactPhone,
    required String customerNote,
  }) async {
    final quoteToken = state.quote?.quoteToken;
    if (quoteToken == null || quoteToken.isEmpty) {
      state = state.copyWith(
        submitError: () => 'Báo giá đã hết hạn. Vui lòng tải lại báo giá.',
      );
      return null;
    }
    state = state.copyWith(isSubmitting: true, submitError: () => null);
    try {
      final result = await _repository.submitOrder(
        draft: draft,
        contactName: contactName,
        contactPhone: contactPhone,
        customerNote: customerNote,
        quoteToken: quoteToken,
        voucherCode: state.selectedVoucherCode,
      );
      state = state.copyWith(isSubmitting: false);
      return result;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        submitError: () => e.toString().replaceFirst('Exception: ', ''),
      );
      return null;
    }
  }
}

final bookingConfirmationNotifierProvider =
    StateNotifierProvider.autoDispose<
      BookingConfirmationNotifier,
      BookingConfirmationState
    >((ref) {
      final repo = ref.watch(bookingOrderRepositoryProvider);
      return BookingConfirmationNotifier(repo);
    });
