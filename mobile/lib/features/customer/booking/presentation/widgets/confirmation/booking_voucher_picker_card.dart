import 'package:flutter/material.dart';
import 'package:mobile/core/utils/currency_utils.dart';

import '../../../domain/entities/order_quote_entity.dart';
import './booking_voucher_selection_bottom_sheet.dart';

class BookingVoucherPickerCard extends StatelessWidget {
  final String providerServiceId;
  final String? selectedVoucherCode;
  final OrderQuoteEntity? quote;
  final ValueChanged<String?> onVoucherChanged;

  const BookingVoucherPickerCard({
    super.key,
    required this.providerServiceId,
    required this.selectedVoucherCode,
    this.quote,
    required this.onVoucherChanged,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = CurrencyUtils.vndCurrency;

    final hasVoucher =
        selectedVoucherCode != null && selectedVoucherCode!.trim().isNotEmpty;
    final discountAmount = quote?.discountAmount ?? 0;
    final issuer = quote?.voucherIssuer;
    final isPlatform = issuer == 'PLATFORM';

    return Container(
      decoration: BoxDecoration(
        color: hasVoucher ? const Color(0xFFEFF6F5) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasVoucher
              ? const Color(0xFF0F766E)
              : const Color(0xFFE2E8F0),
          width: hasVoucher ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () {
            BookingVoucherSelectionBottomSheet.show(
              context,
              providerServiceId: providerServiceId,
              currentVoucherCode: selectedVoucherCode,
              onVoucherSelected: onVoucherChanged,
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: hasVoucher
                        ? const Color(0xFF0F766E).withValues(alpha: 0.15)
                        : const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.confirmation_num_outlined,
                    color: Color(0xFF0F766E),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: hasVoucher
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  selectedVoucherCode!,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F766E),
                                    letterSpacing: 0.4,
                                  ),
                                ),
                                if (issuer != null) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 1.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isPlatform
                                          ? const Color(0xFF0F766E)
                                              .withValues(alpha: 0.15)
                                          : const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      isPlatform ? 'Sàn Lambe' : 'Thợ ưu đãi',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: isPlatform
                                            ? const Color(0xFF0F766E)
                                            : const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              discountAmount > 0
                                  ? 'Tiết kiệm ${currencyFormat.format(discountAmount)} trên giá dịch vụ'
                                  : 'Đã áp dụng mã giảm giá',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0F766E),
                              ),
                            ),
                          ],
                        )
                      : const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ưu đãi & Voucher',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0B1C30),
                              ),
                            ),
                            SizedBox(height: 1),
                            Text(
                              'Chọn hoặc nhập mã giảm giá',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFF94A3B8),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
