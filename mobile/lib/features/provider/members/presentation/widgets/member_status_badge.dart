import 'package:flutter/material.dart';

class MemberStatusBadge extends StatelessWidget {
  final String status;
  final String? verificationStatus;

  const MemberStatusBadge({
    super.key,
    required this.status,
    this.verificationStatus,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;

    switch (status) {
      case 'ACTIVE':
        bg = const Color(0xFFE0F2FE);
        fg = const Color(0xFF0F766E);
        label = 'Đang hoạt động';
      case 'PENDING_VERIFICATION':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFD97706);
        label = _verificationLabel(verificationStatus) ?? 'Chờ xác minh';
      case 'SUSPENDED':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFDC2626);
        label = 'Tạm đình chỉ';
      case 'LEFT':
        bg = const Color(0xFFF3F4F6);
        fg = const Color(0xFF6B7280);
        label = 'Đã rời';
      default:
        bg = const Color(0xFFF3F4F6);
        fg = const Color(0xFF6B7280);
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }

  String? _verificationLabel(String? kycStatus) {
    return switch (kycStatus) {
      'PENDING_REVIEW' => 'KYC đang duyệt',
      'NEEDS_CHANGES' => 'KYC cần bổ sung',
      'REJECTED' => 'KYC bị từ chối',
      'APPROVED' => 'KYC đã duyệt',
      _ => null,
    };
  }
}
