import 'package:flutter/material.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../providers/booking_confirmation_providers.dart';
import '../../domain/entities/booking_draft_entity.dart';
import '../../domain/entities/order_quote_entity.dart';
import '../providers/booking_draft_provider.dart';
import '../widgets/booking_step_progress_bar.dart';
import '../widgets/confirmation/booking_awaiting_dialog.dart';
import '../widgets/confirmation/booking_details_cards.dart';
import '../widgets/confirmation/booking_pricing_breakdown_card.dart';
import '../widgets/confirmation/booking_voucher_picker_card.dart';

class BookingConfirmationScreen extends ConsumerStatefulWidget {
  const BookingConfirmationScreen({super.key});

  @override
  ConsumerState<BookingConfirmationScreen> createState() =>
      _BookingConfirmationScreenState();
}

class _BookingConfirmationScreenState
    extends ConsumerState<BookingConfirmationScreen> {
  final TextEditingController _noteController = TextEditingController();
  final TextEditingController _contactNameController = TextEditingController();
  final TextEditingController _contactPhoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final draft = ref.read(bookingDraftProvider);
      final user = ref.read(authNotifierProvider).valueOrNull;

      if (draft != null) {
        final initialName = draft.contactName.isNotEmpty
            ? draft.contactName
            : (user?.fullName ?? '');
        final initialPhone = draft.contactPhone.isNotEmpty
            ? draft.contactPhone
            : (user?.phone ?? '');
        _noteController.text = draft.customerNote;
        _contactNameController.text = initialName;
        _contactPhoneController.text = initialPhone;
        if (draft.contactName.isEmpty && initialName.isNotEmpty) {
          ref.read(bookingDraftProvider.notifier).setContactName(initialName);
        }
        if (draft.contactPhone.isEmpty && initialPhone.isNotEmpty) {
          ref.read(bookingDraftProvider.notifier).setContactPhone(initialPhone);
        }
        ref
            .read(bookingConfirmationNotifierProvider.notifier)
            .fetchQuote(draft);
      }
    });
  }

  @override
  void dispose() {
    _noteController.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  void _onSelectVoucher(String? voucherCode) {
    final draft = ref.read(bookingDraftProvider);
    ref
        .read(bookingConfirmationNotifierProvider.notifier)
        .selectVoucher(voucherCode, draft);
  }

  void _onSelectSuggestedSlot(DateTime slot) {
    ref.read(bookingDraftProvider.notifier).setScheduledAt(slot);
    final updatedDraft = ref.read(bookingDraftProvider);
    if (updatedDraft != null) {
      ref
          .read(bookingConfirmationNotifierProvider.notifier)
          .fetchQuote(updatedDraft);
    }
  }

  Future<void> _submitOrder(BookingDraftEntity draft) async {
    if (draft.providerServiceId == null) {
      AppDialog.warning(
        context,
        message: 'Vui lòng chọn chuyên viên trước khi đặt lịch.',
      );
      return;
    }

    final hasAddress =
        (draft.addressSource == 'SAVED' && draft.customerAddressId != null) ||
        draft.inlineAddress != null ||
        draft.selectedAddress != null;

    if (!hasAddress) {
      AppDialog.warning(
        context,
        message: 'Vui lòng cung cấp địa chỉ phục vụ trước khi đặt lịch.',
      );
      return;
    }

    if (draft.rematchSourceOrderId == null) {
      final contactDraft = draft.copyWith(
        contactName: _contactNameController.text,
        contactPhone: _contactPhoneController.text,
      );
      if (!contactDraft.hasValidContact) {
        AppDialog.warning(
          context,
          message: 'Vui lòng nhập họ tên (>= 2 ký tự) và số điện thoại Việt Nam hợp lệ.',
        );
        return;
      }
    }

    final confirmState = ref.read(bookingConfirmationNotifierProvider);
    final currentQuote = confirmState.quote;
    if (currentQuote != null && !currentQuote.available) {
      AppDialog.warning(
        context,
        message:
            currentQuote.reason ??
            'Chuyên viên chưa thể nhận đơn vào khung giờ này.',
      );
      return;
    }

    final order = await ref
        .read(bookingConfirmationNotifierProvider.notifier)
        .submitOrder(
          draft: draft,
          contactName: _contactNameController.text,
          contactPhone: _contactPhoneController.text,
          customerNote: _noteController.text,
        );

    if (order != null && mounted) {
      await BookingAwaitingDialog.show(
        context,
        submission: order,
        providerName: draft.providerDisplayName ?? 'chuyên viên',
      );
    } else if (mounted) {
      final err = ref.read(bookingConfirmationNotifierProvider).submitError;
      if (err != null) {
        AppDialog.error(context, message: err);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);
    final confirmState = ref.watch(bookingConfirmationNotifierProvider);
    final quote = confirmState.quote;
    final isLoadingQuote = confirmState.isLoadingQuote;
    final quoteError = confirmState.quoteError;
    final isSubmitting = confirmState.isSubmitting;
    final selectedVoucherCode = confirmState.selectedVoucherCode;

    if (draft == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text('Xác nhận đặt lịch'),
          centerTitle: true,
          elevation: 0,
          backgroundColor: Colors.white,
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Phiên đặt lịch đã hết hạn hoặc chưa có thông tin.'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Quay lại trang chủ'),
              ),
            ],
          ),
        ),
      );
    }

    final currencyFormatter = CurrencyUtils.vndCurrency;

    final servicePrice =
        quote?.servicePriceAmount ??
        draft.providerPriceAmount ??
        draft.service.minPriceAmount;
    final totalAmount = quote?.totalAmount ?? servicePrice;
    final distanceKm = quote?.distanceKm ?? draft.providerDistanceKm ?? 0.0;
    final isQuoteUnavailable = quote != null && !quote.available;
    final canSubmit =
        !isSubmitting &&
        !isLoadingQuote &&
        quote != null &&
        quote.available &&
        quote.quoteToken != null;

    return GuidanceTrigger(
      tourId: 'customer_confirm',
      enabled: !isLoadingQuote && !isSubmitting && quote != null,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text(
            'Xác nhận đặt lịch',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0B1C30),
            ),
          ),
          centerTitle: true,
          backgroundColor: Colors.white,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 19,
              color: Color(0xFF0B1C30),
            ),
            onPressed: () => context.pop(),
          ),
          bottom: const BookingStepProgressBar(currentStep: 3),
        ),
        body: GuidanceAnchor(
          id: 'booking_summary',
          child: ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            children: [
              // Banner cảnh báo thợ bận hoặc lỗi báo giá nếu có
              if (isLoadingQuote) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF0F766E).withValues(alpha: 0.25),
                    ),
                  ),
                  child: const Row(
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Đang kiểm tra lịch trống và lấy báo giá chính thức...',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF0F766E),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ] else if (isQuoteUnavailable) ...[
                _buildUnavailableBanner(
                  context,
                  quote,
                  draft.rematchSourceOrderId != null,
                ),
                const SizedBox(height: 12),
              ] else if (quoteError != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        size: 20,
                        color: Color(0xFFDC2626),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          quoteError,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFFB91C1C),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => ref
                            .read(bookingConfirmationNotifierProvider.notifier)
                            .fetchQuote(draft),
                        child: const Text('Thử lại'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              BookingDetailsCards(
                draft: draft,
                contactNameController: _contactNameController,
                contactPhoneController: _contactPhoneController,
                noteController: _noteController,
                onChangeProvider: () => context.pop(),
                onContactNameChanged: (value) => ref
                    .read(bookingDraftProvider.notifier)
                    .setContactName(value),
                onContactPhoneChanged: (value) => ref
                    .read(bookingDraftProvider.notifier)
                    .setContactPhone(value),
                onNoteChanged: (value) => ref
                    .read(bookingDraftProvider.notifier)
                    .setCustomerNote(value),
              ),
              if (draft.providerServiceId != null) ...[
                const SizedBox(height: 12),
                BookingVoucherPickerCard(
                  providerServiceId: draft.providerServiceId!,
                  selectedVoucherCode: selectedVoucherCode,
                  quote: quote,
                  onVoucherChanged: _onSelectVoucher,
                ),
              ],
              const SizedBox(height: 12),
              BookingPricingBreakdownCard(
                quote: quote,
                fallbackServicePrice: servicePrice,
                distanceKm: distanceKm,
              ),
              const SizedBox(height: 80),
            ],
          ),
        ),
        bottomNavigationBar: Container(
          padding: EdgeInsets.fromLTRB(
            16,
            12,
            16,
            MediaQuery.of(context).padding.bottom + 12,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            border: const Border(
              top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, -3),
              ),
            ],
          ),
          child: Row(
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tổng thanh toán',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                  ),
                  Text(
                    isLoadingQuote
                        ? 'Đang tính...'
                        : currencyFormatter.format(totalAmount),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F766E),
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: canSubmit ? () => _submitOrder(draft) : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      disabledBackgroundColor: const Color(0xFFE2E8F0),
                      foregroundColor: Colors.white,
                      disabledForegroundColor: const Color(0xFF94A3B8),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(100),
                      ),
                    ),
                    child: isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            isQuoteUnavailable
                                ? 'Chuyên viên bận lịch'
                                : (isLoadingQuote
                                      ? 'Đang tính giá...'
                                      : 'Xác nhận đặt lịch'),
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUnavailableBanner(
    BuildContext context,
    OrderQuoteEntity quote,
    bool isRematch,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.event_busy_rounded,
                size: 20,
                color: Color(0xFFDC2626),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  quote.reason ??
                      'Chuyên viên không thể nhận đơn vào khung giờ này.',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFB91C1C),
                  ),
                ),
              ),
            ],
          ),
          if (quote.suggestedSlots.isNotEmpty && !isRematch) ...[
            const SizedBox(height: 8),
            const Text(
              'Gợi ý khung giờ thợ đang trống (bấm để đổi giờ):',
              style: TextStyle(fontSize: 11.5, color: Color(0xFFB91C1C)),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: quote.suggestedSlots.map((slot) {
                final text = DateFormat('HH:mm - dd/MM').format(slot);
                return InkWell(
                  onTap: () => _onSelectSuggestedSlot(slot),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.schedule_rounded,
                          size: 13,
                          color: Color(0xFFDC2626),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          text,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFDC2626),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}
