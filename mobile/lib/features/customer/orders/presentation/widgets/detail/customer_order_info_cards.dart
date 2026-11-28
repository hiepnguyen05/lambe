import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/utils/currency_utils.dart';

import '../../../domain/entities/customer_order_entity.dart';

class CustomerOrderServiceTimeCard extends StatelessWidget {
  final CustomerOrderEntity order;

  const CustomerOrderServiceTimeCard({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final isAsap = order.bookingType == 'ASAP';
    final timeStr = isAsap
        ? 'Phục vụ làm ngay (ASAP)'
        : (order.scheduledAt != null
              ? DateFormat('HH:mm - dd/MM/yyyy').format(order.scheduledAt!)
              : 'Đã hẹn trước');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.content_cut_rounded,
                size: 17,
                color: Color(0xFF0F766E),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  order.serviceName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 1),
                child: Icon(
                  Icons.schedule_rounded,
                  size: 15,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Wrap(
                  spacing: 4,
                  runSpacing: 2,
                  children: [
                    Text(
                      timeStr,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: isAsap
                            ? const Color(0xFFD97706)
                            : const Color(0xFF0F766E),
                      ),
                    ),
                    const Text('•', style: TextStyle(color: Color(0xFFCBD5E1))),
                    Text(
                      '${order.durationMinutes} phút',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (order.customerNote != null &&
              order.customerNote!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.edit_note_rounded,
                  size: 16,
                  color: Color(0xFF64748B),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Ghi chú: ${order.customerNote!}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class CustomerOrderAddressCard extends StatelessWidget {
  final CustomerOrderEntity order;
  final String? addressOverride;

  const CustomerOrderAddressCard({
    super.key,
    required this.order,
    this.addressOverride,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 17,
                color: Color(0xFF0F766E),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Địa chỉ & Người nhận',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            addressOverride ??
                order.addressLine ??
                'Tại địa chỉ khách hàng cung cấp',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF1E293B),
            ),
          ),
          if (order.addressNote != null &&
              order.addressNote!.trim().isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              'Chỉ dẫn: ${order.addressNote!}',
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
            ),
          ],
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 1),
                child: Icon(
                  Icons.person_outline_rounded,
                  size: 14,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Wrap(
                  spacing: 4,
                  runSpacing: 2,
                  children: [
                    Text(
                      order.contactName ?? 'Khách hàng',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF475569),
                      ),
                    ),
                    if (order.contactPhone != null &&
                        order.contactPhone!.isNotEmpty) ...[
                      const Text('•', style: TextStyle(color: Color(0xFFCBD5E1))),
                      Text(
                        order.contactPhone!,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class CustomerOrderPricingCard extends StatelessWidget {
  final CustomerOrderEntity order;
  final NumberFormat? currencyFormatter;
  final int platformFundedAmount;
  final int commissionAmount;
  final int commissionRateBps;
  final int? netEarnings;
  final String? earningsLabel;
  final bool showEarningsBreakdown;

  const CustomerOrderPricingCard({
    super.key,
    required this.order,
    this.currencyFormatter,
    this.platformFundedAmount = 0,
    this.commissionAmount = 0,
    this.commissionRateBps = 0,
    this.netEarnings,
    this.earningsLabel,
    this.showEarningsBreakdown = false,
  });

  Widget _buildRow(
    String label,
    String value, {
    Color? valueColor,
    bool isBold = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isBold ? FontWeight.w700 : FontWeight.w400,
              color: isBold ? const Color(0xFF0F172A) : const Color(0xFF64748B),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: isBold ? 14 : 13,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: valueColor ?? const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final formatter = currencyFormatter ?? CurrencyUtils.vndCurrency;
    final hasVoucherDiscount = order.discountAmount > 0;
    final subtotal =
        order.subtotalAmount ??
        (order.servicePriceAmount + order.travelFeeAmount);
    final isPlatformVoucher = order.voucherIssuer == 'PLATFORM';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.receipt_long_rounded,
                size: 17,
                color: Color(0xFF0F766E),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Chi tiết thanh toán',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _buildRow(
            'Giá dịch vụ',
            formatter.format(order.servicePriceAmount),
          ),
          for (final item in order.addOnSnapshot?.accepted ?? []) ...[
            const SizedBox(height: 6),
            _buildRow(
              '${item.serviceName} (phát sinh)',
              formatter.format(item.priceAmount),
            ),
          ],
          const SizedBox(height: 6),
          _buildRow(
            order.travelDistanceKm != null && order.travelDistanceKm! > 0
                ? 'Phí di chuyển (${order.travelDistanceKm!.toStringAsFixed(1)} km)'
                : 'Phí di chuyển',
            order.travelFeeAmount == 0
                ? 'Miễn phí'
                : formatter.format(order.travelFeeAmount),
            valueColor: order.travelFeeAmount == 0
                ? const Color(0xFF16A34A)
                : const Color(0xFF1E293B),
          ),
          if (hasVoucherDiscount) ...[
            const SizedBox(height: 6),
            _buildRow(
              'Tạm tính',
              formatter.format(subtotal),
              valueColor: const Color(0xFF64748B),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    children: [
                      const Text(
                        'Giảm giá voucher',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      if (order.voucherCode != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1.5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Text(
                            order.voucherCode!,
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ),
                      if (order.voucherIssuer != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1.5,
                          ),
                          decoration: BoxDecoration(
                            color: isPlatformVoucher
                                ? const Color(0xFFCCFBF1)
                                : const Color(0xFFEDE9FE),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isPlatformVoucher ? 'Sàn' : 'Thợ',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isPlatformVoucher
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFF7C3AED),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '-${formatter.format(order.discountAmount)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ],
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Divider(height: 1, color: Color(0xFFE2E8F0)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Text(
                  'Tổng tiền mặt COD',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatter.format(order.totalAmount),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F766E),
                ),
              ),
            ],
          ),
          if (showEarningsBreakdown) ...[
            const SizedBox(height: 8),
            if (platformFundedAmount > 0) ...[
              _buildRow(
                'Trợ giá từ sàn',
                '+${formatter.format(platformFundedAmount)}',
                valueColor: const Color(0xFF16A34A),
              ),
              const SizedBox(height: 6),
            ],
            _buildRow(
              commissionRateBps > 0
                  ? 'Phí nền tảng (${(commissionRateBps / 100).toStringAsFixed(0)}%)'
                  : 'Phí nền tảng',
              '-${formatter.format(commissionAmount)}',
              valueColor: const Color(0xFFDC2626),
            ),
            const SizedBox(height: 6),
            _buildRow(
              earningsLabel ?? 'Thực nhận',
              formatter.format(
                netEarnings ??
                    (order.totalAmount + platformFundedAmount - commissionAmount),
              ),
              valueColor: const Color(0xFF15803D),
              isBold: true,
            ),
          ],
        ],
      ),
    );
  }
}

class CustomerOrderReviewSummaryCard extends StatelessWidget {
  final OrderReviewEntity review;
  final String title;

  const CustomerOrderReviewSummaryCard({
    super.key,
    required this.review,
    this.title = 'Đánh giá của bạn',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF15803D),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Row(
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < review.rating
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    size: 16,
                    color: const Color(0xFF0F766E),
                  ),
                ),
              ),
            ],
          ),
          if (review.comment != null && review.comment!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              '“${review.comment!}”',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF166534)),
            ),
          ],
        ],
      ),
    );
  }
}
