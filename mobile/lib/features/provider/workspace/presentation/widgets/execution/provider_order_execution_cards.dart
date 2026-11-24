import 'package:flutter/material.dart';

class ProviderOrderCancellationBanner extends StatelessWidget {
  final Map<String, dynamic> cancellationReq;
  final String status;
  final String? cancellationStatus;
  final String Function(String? code) mapCancellationReason;

  const ProviderOrderCancellationBanner({
    super.key,
    required this.cancellationReq,
    required this.status,
    required this.cancellationStatus,
    required this.mapCancellationReason,
  });

  @override
  Widget build(BuildContext context) {
    if (status == 'CANCELLED') return const SizedBox.shrink();

    final (title, description) = switch (cancellationStatus) {
      'SUPPORT_REVIEW' => (
        'Hỗ trợ đang xem xét yêu cầu hủy',
        'Khách chưa đồng ý hủy. Đơn tạm dừng trong khi bộ phận hỗ trợ xử lý.',
      ),
      'DENIED' => (
        'Yêu cầu hủy không được chấp nhận',
        'Đơn tiếp tục theo tiến trình hiện tại.',
      ),
      _ => (
        'Đã gửi yêu cầu hủy đơn',
        'Lý do: ${mapCancellationReason(cancellationReq['reason']?.toString())}. Đang chờ khách phản hồi.',
      ),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Color(0xFFDC2626),
            size: 22,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF991B1B),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 12,
                    height: 1.35,
                    color: Color(0xFF7F1D1D),
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
