import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class FeedEndOfFeedNote extends StatelessWidget {
  const FeedEndOfFeedNote({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.spa_rounded,
              color: AppColors.primary,
              size: 24,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Bạn đã xem hết các tác phẩm mới nhất',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 3),
          const Text(
            'Được chia sẻ bởi Đối tác làm đẹp Lambe xác thực',
            style: TextStyle(
              fontSize: 11.5,
              color: AppColors.outline,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

