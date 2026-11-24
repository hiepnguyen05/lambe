import 'package:flutter/material.dart';

class OrderStatusBadge extends StatelessWidget {
  final String status;
  final String? cancellationStatus;
  final bool isCompact;

  const OrderStatusBadge({
    super.key,
    required this.status,
    this.cancellationStatus,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    final config = _getStatusConfig(status, cancellationStatus);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 6 : 9,
        vertical: isCompact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: config.backgroundColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: config.borderColor, width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(config.icon, size: isCompact ? 11 : 13, color: config.textColor),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              config.label,
              style: TextStyle(
                fontSize: isCompact ? 10.5 : 12,
                fontWeight: FontWeight.w700,
                color: config.textColor,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  _StatusBadgeConfig _getStatusConfig(
    String status,
    String? cancellationStatus,
  ) {
    if (status == 'SAFETY_HOLD') {
      return const _StatusBadgeConfig(
        label: 'Tạm dừng vì an toàn',
        textColor: Color(0xFFB91C1C),
        backgroundColor: Color(0xFFFEF2F2),
        borderColor: Color(0xFFFECACA),
        icon: Icons.shield_outlined,
      );
    }

    if (cancellationStatus == 'PENDING') {
      return const _StatusBadgeConfig(
        label: 'Chờ xử lý hủy',
        textColor: Color(0xFFC2410C),
        backgroundColor: Color(0xFFFFF7ED),
        borderColor: Color(0xFFFFEDD5),
        icon: Icons.hourglass_empty_rounded,
      );
    }

    switch (status) {
      case 'PENDING':
        return const _StatusBadgeConfig(
          label: 'Chờ xác nhận',
          textColor: Color(0xFFD97706),
          backgroundColor: Color(0xFFFFFBEB),
          borderColor: Color(0xFFFDE68A),
          icon: Icons.schedule_rounded,
        );
      case 'CONFIRMED':
        return const _StatusBadgeConfig(
          label: 'Đã xác nhận',
          textColor: Color(0xFF0F766E),
          backgroundColor: Color(0xFFF0FDFA),
          borderColor: Color(0xFFCCFBF1),
          icon: Icons.check_circle_outline_rounded,
        );
      case 'EN_ROUTE':
        return const _StatusBadgeConfig(
          label: 'Đang di chuyển',
          textColor: Color(0xFF2563EB),
          backgroundColor: Color(0xFFEFF6FF),
          borderColor: Color(0xFFDBEAFE),
          icon: Icons.near_me_outlined,
        );
      case 'ARRIVED':
        return const _StatusBadgeConfig(
          label: 'Đã đến điểm hẹn',
          textColor: Color(0xFF7C3AED),
          backgroundColor: Color(0xFFF5F3FF),
          borderColor: Color(0xFFDDD6FE),
          icon: Icons.location_on_outlined,
        );
      case 'IN_PROGRESS':
        return const _StatusBadgeConfig(
          label: 'Đang thực hiện',
          textColor: Color(0xFF0284C7),
          backgroundColor: Color(0xFFF0F9FF),
          borderColor: Color(0xFFE0F2FE),
          icon: Icons.cut_rounded,
        );
      case 'PAYMENT_PENDING':
        return const _StatusBadgeConfig(
          label: 'Chờ thanh toán',
          textColor: Color(0xFFEA580C),
          backgroundColor: Color(0xFFFFF7ED),
          borderColor: Color(0xFFFFEDD5),
          icon: Icons.payment_rounded,
        );
      case 'COMPLETED':
        return const _StatusBadgeConfig(
          label: 'Hoàn thành',
          textColor: Color(0xFF15803D),
          backgroundColor: Color(0xFFF0FDF4),
          borderColor: Color(0xFFDCFCE7),
          icon: Icons.task_alt_rounded,
        );
      case 'CANCELLED':
        return const _StatusBadgeConfig(
          label: 'Đã hủy',
          textColor: Color(0xFFDC2626),
          backgroundColor: Color(0xFFFEF2F2),
          borderColor: Color(0xFFFEE2E2),
          icon: Icons.cancel_outlined,
        );
      default:
        return _StatusBadgeConfig(
          label: status,
          textColor: const Color(0xFF64748B),
          backgroundColor: const Color(0xFFF8FAFC),
          borderColor: const Color(0xFFE2E8F0),
          icon: Icons.info_outline_rounded,
        );
    }
  }
}

class _StatusBadgeConfig {
  final String label;
  final Color textColor;
  final Color backgroundColor;
  final Color borderColor;
  final IconData icon;

  const _StatusBadgeConfig({
    required this.label,
    required this.textColor,
    required this.backgroundColor,
    required this.borderColor,
    required this.icon,
  });
}

