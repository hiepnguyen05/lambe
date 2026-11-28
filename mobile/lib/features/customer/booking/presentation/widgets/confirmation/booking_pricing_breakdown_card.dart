import 'package:flutter/material.dart';
import 'package:mobile/core/utils/currency_utils.dart';

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
    final currencyFormatter = CurrencyUtils.vndCurrency;

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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 16,
                  color: Color(0xFF0F766E),
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Chi tiết thanh toán chính thức',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
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
                ? const Color(0xFF059669)
                : const Color(0xFF0B1C30),
          ),
          if (discount > 0) ...[
            const SizedBox(height: 8),
            _buildPriceRow(
              'Tạm tính',
              currencyFormatter.format(subtotal),
              valueColor: const Color(0xFF64748B),
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
                        color: Color(0xFF0F766E),
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
                          color: const Color(0xFFEFF6F5),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          isPlatform ? 'Sàn' : 'Thợ',
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
                Text(
                  '-${currencyFormatter.format(discount)}',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F766E),
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
              valueColor: const Color(0xFF64748B),
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(
              height: 1,
              color: Color(0xFFE2E8F0),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tổng tiền mặt (COD)',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Thanh toán sau khi hoàn tất',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              Text(
                currencyFormatter.format(totalAmount),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F766E),
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.shield_outlined,
                  size: 15,
                  color: Color(0xFF0F766E),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Cam kết minh bạch giá: Không phát sinh phụ phí ngoài thỏa thuận.',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                      height: 1.3,
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
          style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? const Color(0xFF0B1C30),
          ),
        ),
      ],
    );
  }
}
