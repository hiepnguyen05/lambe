import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class HomeTrustGuaranteeSection extends StatelessWidget {
  const HomeTrustGuaranteeSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFEDF4FE),
        borderRadius: BorderRadius.circular(24),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Thẻ 1: Định danh 100% minh bạch
          _buildTrustCard(
            icon: Icons.badge_outlined,
            iconBg: const Color(0xFFE0F2FE),
            iconColor: const Color(0xFF0284C7),
            title: 'Định danh 100% minh bạch',
            description:
                'Chuyên gia đều có lý lịch trong sạch, chứng minh nhân dân/CCCD và bằng nghề được phê duyệt nghiêm ngặt.',
          ),
          const SizedBox(height: 10),

          // Thẻ 2: Thanh toán sau khi làm xong
          _buildTrustCard(
            icon: Icons.payments_outlined,
            iconBg: const Color(0xFFFFEDD5),
            iconColor: const Color(0xFFEA580C),
            title: 'Thanh toán sau khi làm xong',
            description:
                'Bạn có thể trả tiền mặt trực tiếp cho chuyên viên hoặc chuyển khoản sau khi đã thực sự hài lòng với dịch vụ.',
          ),
          const SizedBox(height: 10),

          // Thẻ 3: Bảo hành hỗ trợ 24h
          _buildTrustCard(
            icon: Icons.support_agent_rounded,
            iconBg: const Color(0xFFDCFCE7),
            iconColor: const Color(0xFF16A34A),
            title: 'Bảo hành hỗ trợ 24h',
            description:
                'Đội ngũ chăm sóc khách hàng hỗ trợ tức nếu màu sơn bong tróc sớm hay dịch vụ chưa đúng cam kết.',
          ),
        ],
      ),
    );
  }

  Widget _buildTrustCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.onSurfaceVariant,
                    height: 1.4,
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
