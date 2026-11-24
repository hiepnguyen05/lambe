import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';

class ProviderOrderAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  final String orderId;
  final String status;
  final VoidCallback? onReportIncident;
  final VoidCallback? onBack;
  final Widget? safetyAction;

  const ProviderOrderAppBar({
    super.key,
    required this.orderId,
    required this.status,
    this.onReportIncident,
    this.onBack,
    this.safetyAction,
  });

  @override
  Size get preferredSize => const Size.fromHeight(64);

  String _formatOrderId(String rawId) {
    if (rawId.isEmpty) return '';
    final code = rawId.length > 8 ? rawId.substring(0, 8) : rawId;
    return 'LB-${code.toUpperCase()}';
  }

  String _statusLabel(String value) => switch (value) {
    'PENDING_PROVIDER' => 'Chờ xác nhận',
    'ACCEPTED' => 'Đã nhận lịch',
    'EN_ROUTE' => 'Đang di chuyển',
    'ARRIVED' => 'Đã đến nơi',
    'IN_PROGRESS' => 'Đang làm việc',
    'SAFETY_HOLD' => 'Tạm dừng vì an toàn',
    'PAYMENT_DISPUTE' => 'Chờ xác minh thanh toán',
    'DISPUTED' => 'Chưa thanh toán · Chờ xử lý',
    'COMPLETED' => 'Đã hoàn thành',
    'CANCELLED' => 'Đã hủy đơn',
    _ => value,
  };

  Color _statusColor(String value) => switch (value) {
    'EN_ROUTE' || 'IN_PROGRESS' => AppColors.primaryContainer,
    'ACCEPTED' || 'ARRIVED' => AppColors.primary,
    'COMPLETED' => const Color(0xFF16A34A),
    'CANCELLED' || 'SAFETY_HOLD' => const Color(0xFFDC2626),
    _ => const Color(0xFF64748B),
  };

  void _goBack(BuildContext context) {
    if (onBack != null) {
      onBack!();
    } else if (GoRouter.of(context).canPop()) {
      context.pop();
    } else {
      context.go('/provider/orders');
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(status);

    return AppBar(
      elevation: 0,
      scrolledUnderElevation: 1,
      backgroundColor: Colors.white,
      automaticallyImplyLeading: false,
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Quay lại',
              onPressed: () => _goBack(context),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Đơn ${_formatOrderId(orderId)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        margin: const EdgeInsets.only(right: 6),
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      Text(
                        _statusLabel(status),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (safetyAction != null) safetyAction!,
            if (onReportIncident != null)
              IconButton(
                tooltip: status == 'ACCEPTED' ? 'Hủy đơn' : 'Báo sự cố',
                onPressed: onReportIncident,
                icon: Icon(
                  status == 'ACCEPTED'
                      ? Icons.cancel_outlined
                      : Icons.report_problem_outlined,
                  color: Color(0xFF9A5A2E),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
