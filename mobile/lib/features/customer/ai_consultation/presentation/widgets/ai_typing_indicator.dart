import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class AiTypingIndicator extends StatelessWidget {
  const AiTypingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return Align(
      key: const Key('ai-typing-indicator'),
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 4, 70, 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
              ),
            ),
            SizedBox(width: 10),
            Text(
              'Lambe đang tư vấn...',
              style: TextStyle(
                color: AppColors.onSurfaceVariant,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
