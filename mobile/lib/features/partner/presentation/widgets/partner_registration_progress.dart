import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

enum PartnerRegistrationStep {
  type('Loại hình'),
  info('Thông tin'),
  services('Dịch vụ'),
  identity('Danh tính'),
  expertise('Năng lực'),
  submit('Hoàn tất');

  final String label;

  const PartnerRegistrationStep(this.label);
}

class PartnerRegistrationProgress extends StatelessWidget {
  final PartnerRegistrationStep currentStep;

  const PartnerRegistrationProgress({super.key, required this.currentStep});

  @override
  Widget build(BuildContext context) {
    final currentIndex = currentStep.index;
    final totalSteps = PartnerRegistrationStep.values.length;

    return Semantics(
      label: 'Bước ${currentIndex + 1} trên $totalSteps: ${currentStep.label}',
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
        child: Row(
          children: List.generate(totalSteps, (index) {
            return Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                height: 4,
                decoration: BoxDecoration(
                  color: index <= currentIndex
                      ? AppColors.primaryContainer
                      : AppColors.outlineVariant.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
