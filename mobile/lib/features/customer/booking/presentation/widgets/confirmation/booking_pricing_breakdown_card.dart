import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/order_quote_entity.dart';

class BookingPricingBreakdownCard extends StatelessWidget {
  final OrderQuoteEntity? quote;
  final int fallbackServicePrice;
  final double distanceKm;

  const BookingPricingBreakdownCard({
    super.key,
    this.quote,
    required this.fallbackServicePrice,
    required this.distanceKm,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    final servicePrice = quote?.servicePriceAmount ?? fallbackServicePrice;
    final travelFee = quote?.travelFeeAmount ?? 0;
    final travelKm = quote?.travelDistanceKm ?? distanceKm;
    final subtotal = quote?.subtotalAmount ?? (servicePrice + travelFee);
    final discount = quote?.discountAmount ?? 0;
    final totalAmount = quote?.totalAmount ?? (subtotal - discount);
    final voucherCode = quote?.voucherCode;
    final voucherIssuer = quote?.voucherIssuer;
    final isPlatform = voucherIssuer == 'PLATFORM';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.surfaceContainerHighest.withValues(alpha: 0.35),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F766E),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.primaryFixed.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 16,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Chi tiết thanh toán chính thức',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildPriceRow('Giá dịch vụ', currencyFormatter.format(servicePrice)),
          const SizedBox(height: 8),
          _buildPriceRow(
            travelKm > 0
                ? 'Phí di chuyển (~${travelKm.toStringAsFixed(1)} km)'
                : 'Phí di chuyển',
            travelFee == 0
                ? 'Miễn phí (≤ 2 km)'
                : currencyFormatter.format(travelFee),
            valueColor: travelFee == 0
                ? AppColors.activeEmerald
                : AppColors.onSurface,
          ),
          if (discount > 0) ...[
            const SizedBox(height: 8),
            _buildPriceRow(
              'Tạm tính',
              currencyFormatter.format(subtotal),
              valueColor: AppColors.textMuted,
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(
                      voucherCode != null
                          ? 'Voucher ($voucherCode)'
                          : 'Ưu đãi giảm giá',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (voucherIssuer != null) ...[
                      const SizedBox(width: 6),
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
                          isPlatform ? 'Sàn' : 'Thợ',
                          style: TextStyle(
                            fontSize: 10,
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
                Text(
                  '-${currencyFormatter.format(discount)}',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ],
          if (quote != null) ...[
            const SizedBox(height: 8),
            _buildPriceRow(
              'Thời lượng dự kiến',
              '${quote!.durationMinutes} phút',
              valueColor: AppColors.textMuted,
            ),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(
              height: 1,
              color: AppColors.surfaceContainerHighest.withValues(alpha: 0.5),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.primaryFixed.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tổng tiền mặt (COD)',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: AppColors.onSurface,
                        letterSpacing: -0.1,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Thanh toán sau khi hoàn tất',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
                Text(
                  currencyFormatter.format(totalAmount),
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.surfaceContainerHighest.withValues(alpha: 0.35),
              ),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.payments_outlined,
                  size: 16,
                  color: AppColors.primary,
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Khách hàng chỉ thanh toán tiền mặt khi đã hoàn thành dịch vụ. Chuyên viên cần xác nhận yêu cầu trước khi đến.',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? AppColors.onSurface,
          ),
        ),
      ],
    );
  }
}
