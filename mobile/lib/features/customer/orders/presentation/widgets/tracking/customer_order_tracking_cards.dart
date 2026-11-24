import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/customer_order_entity.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';

class CustomerOrderStatusHeroCard extends StatelessWidget {
  final CustomerOrderEntity order;
  final OrderTrackingSnapshot? tracking;
  final Duration remainingTime;

  const CustomerOrderStatusHeroCard({
    super.key,
    required this.order,
    this.tracking,
    required this.remainingTime,
  });

  @override
  Widget build(BuildContext context) {
    String title = 'Đang xử lý đơn hàng';
    String subtitle = 'Hệ thống đang đồng bộ tiến trình phục vụ';
    IconData icon = Icons.info_outline_rounded;
    Color iconColor = AppColors.primary;
    Color bgColor = AppColors.primaryFixed.withValues(alpha: 0.15);
    Color borderColor = AppColors.primaryFixedDim.withValues(alpha: 0.4);

    if (order.isPending) {
      final minutes = remainingTime.inMinutes;
      final seconds = remainingTime.inSeconds % 60;
      final timeFormatted =
          '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
      title = 'Chờ chuyên viên xác nhận';
      subtitle = 'Thời hạn phản hồi còn: $timeFormatted';
      icon = Icons.hourglass_top_rounded;
      iconColor = AppColors.hotBadgeText;
      bgColor = AppColors.hotBadgeBg;
      borderColor = AppColors.starAmber.withValues(alpha: 0.35);
    } else if (order.isAccepted) {
      title = 'Chuyên viên đã nhận lịch!';
      subtitle = 'Chuyên viên đang sắp xếp dụng cụ để di chuyển';
      icon = Icons.check_circle_rounded;
      iconColor = AppColors.primary;
      bgColor = AppColors.primaryFixed.withValues(alpha: 0.15);
      borderColor = AppColors.primaryFixedDim.withValues(alpha: 0.4);
    } else if (order.isEnRoute) {
      title = 'Chuyên viên đang di chuyển tới';
      subtitle = tracking?.hasFreshPosition != true
          ? 'Đang chờ vị trí mới từ chuyên viên'
          : tracking?.durationSeconds == null
          ? 'Vị trí đang được cập nhật; chưa có tuyến đường'
          : 'Dự kiến đến sau khoảng ${(tracking!.durationSeconds! / 60).ceil()} phút';
      icon = Icons.two_wheeler_rounded;
      iconColor = const Color(0xFF2563EB);
      bgColor = const Color(0xFFEFF6FF);
      borderColor = const Color(0xFFBFDBFE);
    } else if (order.isArrived) {
      title = 'Chuyên viên đã đến nơi! 📍';
      subtitle = 'Vui lòng kiểm tra điện thoại và chuẩn bị đón tiếp';
      icon = Icons.place_rounded;
      iconColor = const Color(0xFF7C3AED);
      bgColor = const Color(0xFFF5F3FF);
      borderColor = const Color(0xFFDDD6FE);
    } else if (order.isInProgress) {
      title = 'Đang thực hiện dịch vụ làm đẹp ✨';
      subtitle = 'Thời gian ước tính: ${order.durationMinutes} phút';
      icon = Icons.content_cut_rounded;
      iconColor = AppColors.primary;
      bgColor = AppColors.primaryFixed.withValues(alpha: 0.25);
      borderColor = AppColors.primaryFixedDim;
    } else if (order.isCompleted) {
      title = 'Dịch vụ đã hoàn tất thành công 🎉';
      subtitle = 'Cảm ơn bạn đã lựa chọn dịch vụ của Lambe';
      icon = Icons.task_alt_rounded;
      iconColor = AppColors.activeEmerald;
      bgColor = AppColors.activeEmeraldRing.withValues(alpha: 0.4);
      borderColor = AppColors.activeEmerald.withValues(alpha: 0.3);
    } else if (order.isCancelled || order.isRejected || order.isExpired) {
      title = 'Đơn hàng đã kết thúc';
      subtitle = 'Đơn đã bị hủy, từ chối hoặc hết hạn tiếp nhận';
      icon = Icons.cancel_rounded;
      iconColor = AppColors.error;
      bgColor = AppColors.errorContainer.withValues(alpha: 0.4);
      borderColor = AppColors.errorContainer;
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
        boxShadow: [
          BoxShadow(
            color: iconColor.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: iconColor.withValues(alpha: 0.12),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: iconColor,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.onSurfaceVariant,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class CustomerOrderTrackingStepper extends StatelessWidget {
  final CustomerOrderEntity order;

  const CustomerOrderTrackingStepper({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final steps = [
      {'key': 'ACCEPTED', 'label': 'Xác nhận'},
      {'key': 'EN_ROUTE', 'label': 'Di chuyển'},
      {'key': 'ARRIVED', 'label': 'Đã đến'},
      {'key': 'IN_PROGRESS', 'label': 'Làm đẹp'},
      {'key': 'COMPLETED', 'label': 'Hoàn tất'},
    ];

    int currentIdx = 0;
    if (order.isAccepted) currentIdx = 0;
    if (order.isEnRoute) currentIdx = 1;
    if (order.isArrived) currentIdx = 2;
    if (order.isInProgress) currentIdx = 3;
    if (order.isCompleted) currentIdx = 4;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceContainerHigh),
        boxShadow: [
          BoxShadow(
            color: AppColors.onBackground.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(steps.length, (index) {
          final isDone = index < currentIdx || order.isCompleted;
          final isCurrent = index == currentIdx && !order.isCompleted;

          Color nodeBorderColor = AppColors.surfaceContainerHighest;
          if (isDone || isCurrent) nodeBorderColor = AppColors.primary;

          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 2.5,
                        color: index == 0
                            ? Colors.transparent
                            : (index <= currentIdx
                                  ? AppColors.primary
                                  : AppColors.surfaceContainerHigh),
                      ),
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isDone
                            ? AppColors.primary
                            : (isCurrent
                                  ? AppColors.surfaceContainerLowest
                                  : AppColors.surfaceContainerLow),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: nodeBorderColor,
                          width: isCurrent ? 2.5 : 1.5,
                        ),
                        boxShadow: isCurrent
                            ? [
                                BoxShadow(
                                  color: AppColors.primary.withValues(alpha: 0.3),
                                  blurRadius: 6,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      child: isDone
                          ? const Icon(
                              Icons.check_rounded,
                              size: 14,
                              color: AppColors.onPrimary,
                            )
                          : (isCurrent
                                ? Center(
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  )
                                : null),
                    ),
                    Expanded(
                      child: Container(
                        height: 2.5,
                        color: index == steps.length - 1
                            ? Colors.transparent
                            : (index < currentIdx
                                  ? AppColors.primary
                                  : AppColors.surfaceContainerHigh),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                Text(
                  steps[index]['label']!,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isCurrent || isDone
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: isCurrent || isDone
                        ? AppColors.onBackground
                        : AppColors.textMuted,
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class CustomerOrderServiceSummaryCard extends StatelessWidget {
  final CustomerOrderEntity order;

  const CustomerOrderServiceSummaryCard({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceContainerHigh),
        boxShadow: [
          BoxShadow(
            color: AppColors.onBackground.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  order.serviceName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onBackground,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                currencyFormatter.format(order.totalAmount),
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(
                Icons.location_on_outlined,
                size: 15,
                color: AppColors.textMuted,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  order.addressLine ?? 'Tại địa chỉ của bạn',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
