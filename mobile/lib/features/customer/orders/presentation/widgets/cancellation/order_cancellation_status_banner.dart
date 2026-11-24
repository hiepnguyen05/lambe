import 'package:flutter/material.dart';

class OrderCancellationStatusBanner extends StatelessWidget {
  final String status;

  const OrderCancellationStatusBanner({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final awaitingSupport = status == 'SUPPORT_REVIEW';
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: awaitingSupport
            ? const Color(0xFFFFFBEB)
            : const Color(0xFFEFF6F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: awaitingSupport
              ? const Color(0xFFFCD34D)
              : const Color(0xFF99F6E4),
        ),
      ),
      child: Row(
        children: [
          Icon(
            awaitingSupport ? Icons.support_agent : Icons.info_outline,
            color: awaitingSupport
                ? const Color(0xFF92400E)
                : const Color(0xFF0F766E),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              awaitingSupport
                  ? 'Yêu cầu hủy đã chuyển bộ phận hỗ trợ. Đơn tạm dừng cho đến khi có quyết định.'
                  : 'Hỗ trợ không chấp nhận yêu cầu hủy. Đơn tiếp tục theo tiến trình hiện tại.',
              style: const TextStyle(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
