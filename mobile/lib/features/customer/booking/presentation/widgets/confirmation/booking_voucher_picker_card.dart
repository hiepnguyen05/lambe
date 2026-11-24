import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
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
    final currencyFormat = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    final hasVoucher =
        selectedVoucherCode != null && selectedVoucherCode!.trim().isNotEmpty;
    final discountAmount = quote?.discountAmount ?? 0;
    final issuer = quote?.voucherIssuer;
    final isPlatform = issuer == 'PLATFORM';

    return Container(
      decoration: BoxDecoration(
        color: hasVoucher
            ? AppColors.primaryFixed.withValues(alpha: 0.15)
            : AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasVoucher
              ? AppColors.primary.withValues(alpha: 0.5)
              : AppColors.surfaceContainerHighest.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F766E),
            blurRadius: 10,
            offset: Offset(0, 2),
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: hasVoucher
                        ? AppColors.primaryFixed.withValues(alpha: 0.35)
                        : AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.confirmation_num_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
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
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.primary,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                if (issuer != null) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 1.5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isPlatform
                                          ? AppColors.primaryFixed.withValues(alpha: 0.35)
                                          : AppColors.surfaceContainerHigh,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      isPlatform ? 'Sàn Lambe' : 'Thợ ưu đãi',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.bold,
                                        color: isPlatform
                                            ? AppColors.primary
                                            : AppColors.onSurfaceVariant,
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
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
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
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.onSurface,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Chọn hoặc nhập mã giảm giá',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                ),
                if (hasVoucher)
                  IconButton(
                    icon: const Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: AppColors.textMuted,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => onVoucherChanged(null),
                  )
                else
                  const Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 14,
                    color: AppColors.outline,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
