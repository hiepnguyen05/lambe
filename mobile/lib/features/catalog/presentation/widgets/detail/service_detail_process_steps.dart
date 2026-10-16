import 'package:flutter/material.dart';

class ServiceDetailProcessSteps extends StatelessWidget {
  const ServiceDetailProcessSteps({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tiêu đề phần quy chuẩn
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text(
                'Quy chuẩn dịch vụ tại nhà',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
              Text(
                '3 bước an tâm',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F766E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Container 3 bước
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFF1F5F9)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              children: [
                _buildStepItem(
                  stepNumber: 1,
                  title: 'Đúng giờ & Chuẩn bị chu đáo',
                  description:
                      'Đến tận nơi đúng giờ hẹn, chuẩn bị dụng cụ sạch sẽ và trao đổi kỹ mong muốn của bạn trước khi làm.',
                  isLast: false,
                ),
                const Divider(height: 24, thickness: 1, color: Color(0xFFF1F5F9)),
                _buildStepItem(
                  stepNumber: 2,
                  title: 'Thực hiện chuyên nghiệp',
                  description:
                      'Tay nghề chuẩn chỉnh, thao tác êm ái và tỉ mỉ theo đúng yêu cầu phong cách bạn chọn.',
                  isLast: false,
                ),
                const Divider(height: 24, thickness: 1, color: Color(0xFFF1F5F9)),
                _buildStepItem(
                  stepNumber: 3,
                  title: 'Nghiệm thu & Dọn dẹp gọn gàng',
                  description:
                      'Khách hàng kiểm tra ưng ý, vệ sinh dọn dẹp trả lại không gian sạch đẹp như ban đầu.',
                  isLast: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepItem({
    required int stepNumber,
    required String title,
    required String description,
    required bool isLast,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Số thứ tự bước dạng tròn pastel
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: const Color(0xFF0F766E).withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            '$stepNumber',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F766E),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Nội dung bước
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                description,
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
