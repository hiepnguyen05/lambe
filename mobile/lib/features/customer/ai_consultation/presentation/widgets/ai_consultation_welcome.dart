import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/mascot/lambe_mascot.dart';

class AiConsultationWelcome extends StatelessWidget {
  final ValueChanged<String> onPromptSelected;

  const AiConsultationWelcome({super.key, required this.onPromptSelected});

  static const _prompts = <({IconData icon, String label})>[
    (icon: Icons.content_cut_rounded, label: 'Gợi ý kiểu tóc đi hẹn hò'),
    (
      icon: Icons.face_retouching_natural_rounded,
      label: 'Trang điểm nhẹ cho buổi gặp đầu tiên',
    ),
    (icon: Icons.spa_outlined, label: 'Chăm sóc nào hợp với da dầu?'),
    (
      icon: Icons.location_on_outlined,
      label: 'Tìm chuyên viên phù hợp gần tôi',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                color: AppColors.secondaryContainer.withValues(alpha: 0.5),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: LambeMascot(
                  size: 90,
                  showShadow: false,
                  enableInteraction: false,
                  isPlaying: false,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Bạn đang muốn thay đổi điều gì?',
            style: TextStyle(
              color: AppColors.onSurface,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Hãy kể về dịp sắp tới, phong cách hoặc điều bạn đang băn khoăn. Lambe sẽ tư vấn trước, rồi mới gợi ý dịch vụ khi thật sự phù hợp.',
            style: TextStyle(
              color: AppColors.onSurfaceVariant,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),
          ..._prompts.map(
            (prompt) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Material(
                color: AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: () => onPromptSelected(prompt.label),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: AppColors.outlineVariant.withValues(alpha: 0.5),
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: AppColors.secondaryContainer.withValues(
                              alpha: 0.5,
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            prompt.icon,
                            color: AppColors.primary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            prompt.label,
                            style: const TextStyle(
                              color: AppColors.onSurface,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          color: AppColors.outline,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
