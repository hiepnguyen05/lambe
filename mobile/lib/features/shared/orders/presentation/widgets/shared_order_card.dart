import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/widgets/lambe_icon_widget.dart';
import 'package:mobile/core/widgets/order_status_badge.dart';

/// Dữ liệu hiển thị tối giản cho một thẻ đơn hàng dùng chung giữa Khách và Thợ.
class SharedOrderCardItem {
  final String id;
  final String serviceName;
  final String? serviceIconUrl;
  final String status;
  final String? cancellationStatus;
  final int totalAmount;
  final String bookingType;
  final DateTime? scheduledAt;
  final String locationText;
  final int? reviewRating;
  final bool canReview;
  final VoidCallback onTap;
  final VoidCallback? onOpenReview;

  const SharedOrderCardItem({
    required this.id,
    required this.serviceName,
    this.serviceIconUrl,
    required this.status,
    this.cancellationStatus,
    required this.totalAmount,
    required this.bookingType,
    this.scheduledAt,
    required this.locationText,
    this.reviewRating,
    this.canReview = false,
    required this.onTap,
    this.onOpenReview,
  });
}

/// Thẻ đơn hàng tối giản dùng chung cho màn hình Lịch sử đơn hàng (Khách)
/// và Đơn đặt lịch (Chuyên viên).
class SharedOrderCard extends StatelessWidget {
  static const _primary = Color(0xFF0F766E);
  static const _dark = Color(0xFF0B1C30);
  static const _muted = Color(0xFF64748B);

  final SharedOrderCardItem item;
  final NumberFormat currencyFormatter;

  const SharedOrderCard({
    super.key,
    required this.item,
    required this.currencyFormatter,
  });

  @override
  Widget build(BuildContext context) {
    final isAsap = item.bookingType == 'ASAP';
    final timeText = isAsap
        ? 'Đặt ngay'
        : (item.scheduledAt != null
              ? DateFormat('HH:mm • dd/MM/yyyy').format(item.scheduledAt!)
              : 'Đã hẹn trước');

    final showFooter =
        item.locationText.isNotEmpty ||
        item.canReview ||
        item.reviewRating != null;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: _dark.withValues(alpha: 0.035),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: item.onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Thời gian & Trạng thái
                Row(
                  children: [
                    Icon(
                      isAsap ? Icons.bolt_rounded : Icons.schedule_rounded,
                      size: 14,
                      color: _muted,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        timeText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _muted,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 150),
                      child: OrderStatusBadge(
                        status: item.status,
                        cancellationStatus: item.cancellationStatus,
                        isCompact: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // 2. Ảnh/Icon dịch vụ + Tên dịch vụ + Giá tiền (không bị bóp hẹp)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6F5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Center(
                          child: LambeIconWidget(
                            iconStr: item.serviceIconUrl,
                            size: 24,
                            imageSize: 48,
                            imageFit: BoxFit.cover,
                            color: _primary,
                            fallbackIcon: Icons.spa_rounded,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.serviceName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: _dark,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            currencyFormatter.format(item.totalAmount),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w800,
                              color: _primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // 3. Địa điểm & Thao tác/trạng thái đánh giá gọn
                if (showFooter) ...[
                  const SizedBox(height: 10),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 9),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      if (item.locationText.isNotEmpty) ...[
                        const Icon(
                          Icons.location_on_outlined,
                          size: 14.5,
                          color: _muted,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            item.locationText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: _muted,
                            ),
                          ),
                        ),
                      ] else
                        const Spacer(),
                      if (item.canReview) ...[
                        const SizedBox(width: 8),
                        _CompactReviewAction(onTap: item.onOpenReview),
                      ] else if (item.reviewRating != null) ...[
                        const SizedBox(width: 8),
                        _CompactReviewBadge(rating: item.reviewRating!),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CompactReviewAction extends StatelessWidget {
  final VoidCallback? onTap;

  const _CompactReviewAction({this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF0FDFA),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF99F6E4)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.star_outline_rounded,
                size: 14,
                color: Color(0xFF0F766E),
              ),
              SizedBox(width: 4),
              Text(
                'Đánh giá',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F766E),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactReviewBadge extends StatelessWidget {
  final int rating;

  const _CompactReviewBadge({required this.rating});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDFA),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFCCFBF1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.star_rounded,
            size: 13.5,
            color: Color(0xFF0F766E),
          ),
          const SizedBox(width: 3),
          Text(
            '$rating★',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F766E),
            ),
          ),
        ],
      ),
    );
  }
}
