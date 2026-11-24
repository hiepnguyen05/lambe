import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

/// Khối "Quy trình thực hiện chuẩn" 4 bước dạng Vertical Timeline
/// chuẩn 100% theo mẫu HTML với trục dọc liên tục nối giữa các bước.
class ServiceDetailProcessSteps extends StatelessWidget {
  const ServiceDetailProcessSteps({super.key});

  static const List<(String, String)> _steps = [
    (
      'Tiếp nhận & Kiểm tra dụng cụ vô trùng',
      'Chuyên viên xuất trình thẻ, khử khuẩn và mở bộ kềm tiệt trùng niêm phong trước mặt khách.',
    ),
    (
      'Tư vấn & Thống nhất yêu cầu',
      'Thăm khám tình trạng, tư vấn mẫu mã hoặc liệu trình tối ưu theo sở thích của bạn.',
    ),
    (
      'Tiến hành thực hiện dịch vụ',
      'Thực hiện tỉ mỉ, chuẩn kỹ thuật 5 sao và đảm bảo sự thư giãn tối đa tại nhà.',
    ),
    (
      'Nghiệm thu & Bàn giao sạch sẽ',
      'Khách hàng kiểm tra hài lòng trước khi thanh toán, dọn dẹp sạch sẽ không gian làm đẹp.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16), // p-space-md (16px)
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLowest, // #FFFFFF
          borderRadius: BorderRadius.circular(16), // rounded-2xl
          border: Border.all(
            color: AppColors.outlineVariant.withValues(alpha: 0.20),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tiêu đề & Tag: "Quy trình thực hiện chuẩn" - "4 bước an tâm"
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                Expanded(
                  child: Text(
                    'Quy trình thực hiện chuẩn',
                    style: TextStyle(
                      fontSize: 16, // font-title-md (16px)
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurface, // #0B1C30
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Text(
                  '4 bước an tâm',
                  style: TextStyle(
                    fontSize: 11, // font-label-sm (10px)
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary, // #005C55
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Vertical Timeline 4 bước
            for (int i = 0; i < _steps.length; i++)
              _buildTimelineStep(
                stepIndex: i + 1,
                title: _steps[i].$1,
                description: _steps[i].$2,
                isLast: i == _steps.length - 1,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineStep({
    required int stepIndex,
    required String title,
    required String description,
    required bool isLast,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cột bên trái: Vòng tròn số thứ tự + Đường gióng trục dọc nối tiếp
          Column(
            children: [
              // Vòng tròn số thứ tự (w-8 h-8 rounded-full bg-primary-container)
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer, // #0F766E
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryContainer.withValues(alpha: 0.25),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '$stepIndex',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onPrimary, // #FFFFFF
                  ),
                ),
              ),

              // Đường kẻ dọc kết nối các bước
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: AppColors.surfaceContainerHigh, // #DCE9FF
                    margin: const EdgeInsets.symmetric(vertical: 4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),

          // Cột bên phải: Tiêu đề bước + Nội dung diễn giải
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20, top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14, // font-label-lg (14px)
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurface, // #0B1C30
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    description,
                    textAlign: TextAlign.justify,
                    style: const TextStyle(
                      fontSize: 12, // font-body-sm (12px)
                      fontWeight: FontWeight.w400,
                      color: AppColors.onSurfaceVariant, // #3E4947
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
