import 'package:flutter/material.dart';

import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/core/widgets/order_status_badge.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/presentation/widgets/detail/customer_order_info_cards.dart';
import 'package:mobile/features/customer/orders/presentation/widgets/detail/order_status_timeline.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';

import 'provider_order_customer_section.dart';
import 'provider_order_evidence_card.dart';

/// Displays provider-side order details reusing shared order info cards.
class ProviderOrderDetailView extends StatelessWidget {
  final Map<String, dynamic> order;
  final void Function(String phone) onCall;
  final Widget? topBanners;

  const ProviderOrderDetailView({
    super.key,
    required this.order,
    required this.onCall,
    this.topBanners,
  });

  CustomerOrderEntity _toOrderEntity(String status) {
    final customer = (order['customer'] as Map?) ?? {};
    final total = (order['totalAmount'] as num?)?.toInt() ?? 0;
    final servicePrice =
        (order['servicePriceAmount'] as num?)?.toInt() ?? total;
    final scheduledAtStr = order['scheduledAt']?.toString();
    final scheduledAt = scheduledAtStr != null
        ? DateTime.tryParse(scheduledAtStr)?.toLocal()
        : null;
    final statusHistory = ((order['statusHistory'] as List?) ?? [])
        .whereType<Map>()
        .map(
          (h) =>
              OrderStatusHistoryEntity.fromJson(Map<String, dynamic>.from(h)),
        )
        .toList();
    final reviewMap = order['review'];
    final review = reviewMap is Map
        ? OrderReviewEntity.fromJson(Map<String, dynamic>.from(reviewMap))
        : null;
    final epoch = DateTime.fromMillisecondsSinceEpoch(0);
    final acceptedAddOns = ((order['addOns'] as List?) ?? [])
        .whereType<Map>()
        .where((row) => row['status'] == 'ACCEPTED')
        .map(
          (row) => OrderAddOn(
            id: row['id']?.toString() ?? '',
            providerServiceId: row['providerServiceId']?.toString() ?? '',
            serviceName: row['serviceName']?.toString() ?? 'Dịch vụ',
            status: 'ACCEPTED',
            priceAmount: (row['priceAmount'] as num?)?.toInt() ?? 0,
            durationMinutes: (row['durationMinutes'] as num?)?.toInt() ?? 0,
            commissionAmount: (row['commissionAmount'] as num?)?.toInt() ?? 0,
            proposedTotalAmount:
                (row['proposedTotalAmount'] as num?)?.toInt() ?? total,
            proposedEndAt: epoch,
            expiresAt: epoch,
            createdAt: epoch,
          ),
        )
        .toList(growable: false);
    final addOnSnapshot = acceptedAddOns.isEmpty
        ? null
        : AddOnOrder(
            id: order['id']?.toString() ?? '',
            status: status,
            serviceName: order['serviceName']?.toString() ?? 'Dịch vụ làm đẹp',
            currencyCode: order['currencyCode']?.toString() ?? 'VND',
            servicePriceAmount: servicePrice,
            totalAmount: total,
            durationMinutes: (order['durationMinutes'] as num?)?.toInt() ?? 60,
            updatedAt: DateTime.fromMillisecondsSinceEpoch(0),
            items: acceptedAddOns,
          );

    return CustomerOrderEntity(
      id: order['id']?.toString() ?? '',
      bookingType: order['bookingType']?.toString() ?? 'ASAP',
      scheduledAt: scheduledAt,
      status: status,
      rejectionReason: order['rejectionReason']?.toString(),
      serviceName: order['serviceName']?.toString() ?? 'Dịch vụ làm đẹp',
      servicePriceAmount: servicePrice,
      travelFeeAmount: (order['travelFeeAmount'] as num?)?.toInt() ?? 0,
      travelDistanceKm: (order['travelDistanceKm'] as num?)?.toDouble(),
      subtotalAmount: (order['subtotalAmount'] as num?)?.toInt(),
      discountAmount: (order['discountAmount'] as num?)?.toInt() ?? 0,
      voucherCode: order['voucherCode']?.toString(),
      voucherIssuer: order['voucherIssuer']?.toString(),
      totalAmount: total,
      currencyCode: order['currencyCode']?.toString() ?? 'VND',
      durationMinutes: (order['durationMinutes'] as num?)?.toInt() ?? 60,
      addressLabel: order['addressLabel']?.toString(),
      addressLine: order['addressLine']?.toString(),
      addressNote: order['addressNote']?.toString(),
      contactName:
          order['contactName']?.toString() ?? customer['fullName']?.toString(),
      customerNote: order['customerNote']?.toString(),
      statusHistory: statusHistory,
      review: review,
      addOnSnapshot: addOnSnapshot,
    );
  }

  String _resolveAddressDisplay() {
    final addressLine = order['addressLine']?.toString();
    if (addressLine != null && addressLine.isNotEmpty) return addressLine;
    final addressLabel = order['addressLabel']?.toString();
    if (addressLabel != null && addressLabel.isNotEmpty) {
      return 'Khu vực: $addressLabel (Hiển thị địa chỉ cụ thể khi nhận đơn)';
    }
    return 'Địa chỉ sẽ hiển thị sau khi nhận đơn';
  }

  @override
  Widget build(BuildContext context) {
    final status = order['status']?.toString() ?? 'PENDING_PROVIDER';
    final cancellationStatus = (order['cancellationRequest'] as Map?)?['status']
        ?.toString();
    final rejectionReason = order['rejectionReason']?.toString();
    final orderEntity = _toOrderEntity(status);

    final platformFundedAmount =
        (order['platformFundedAmount'] as num?)?.toInt() ?? 0;
    final commissionAmount = (order['commissionAmount'] as num?)?.round() ?? 0;
    final commissionRateBps =
        (order['commissionRateBps'] as num?)?.toInt() ?? 0;
    final showEarningsBreakdown = commissionAmount > 0 || status == 'COMPLETED';

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        if (topBanners != null) topBanners!,
        if (status == 'REJECTED' &&
            rejectionReason != null &&
            rejectionReason.trim().isNotEmpty) ...[
          _buildReasonBanner(
            title: 'Đơn đã bị từ chối',
            reason: rejectionReason,
          ),
          const SizedBox(height: 12),
        ],
        _buildStatusHeaderCard(status, cancellationStatus),
        const SizedBox(height: 12),
        ProviderOrderCustomerSection(order: order, onCall: onCall),
        const SizedBox(height: 12),
        CustomerOrderServiceTimeCard(order: orderEntity),
        const SizedBox(height: 12),
        CustomerOrderAddressCard(
          order: orderEntity,
          addressOverride: _resolveAddressDisplay(),
        ),
        const SizedBox(height: 12),
        ProviderOrderEvidenceCard(order: order),
        CustomerOrderPricingCard(
          order: orderEntity,
          currencyFormatter: CurrencyUtils.vndCurrency,
          platformFundedAmount: platformFundedAmount,
          commissionAmount: commissionAmount,
          commissionRateBps: commissionRateBps,
          earningsLabel: status == 'COMPLETED'
              ? 'Thực nhận'
              : 'Thực nhận dự kiến',
          showEarningsBreakdown: showEarningsBreakdown,
        ),
        const SizedBox(height: 12),
        if (orderEntity.review != null) ...[
          CustomerOrderReviewSummaryCard(
            review: orderEntity.review!,
            title: 'Đánh giá từ khách hàng',
          ),
          const SizedBox(height: 12),
        ],
        OrderStatusTimeline(
          history: orderEntity.statusHistory,
          currentStatus: status,
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _buildReasonBanner({required String title, required String reason}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: Color(0xFFDC2626),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF991B1B),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Lý do: $reason',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFFB91C1C),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusHeaderCard(String status, String? cancellationStatus) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              status == 'ACCEPTED' && order['bookingType'] == 'SCHEDULED'
                  ? 'Đã xác nhận lịch hẹn'
                  : 'Trạng thái hiện tại',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: OrderStatusBadge(
              status: status,
              cancellationStatus: cancellationStatus,
            ),
          ),
        ],
      ),
    );
  }
}
