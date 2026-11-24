import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../../domain/entities/provider_calendar_block_entity.dart';

class ProviderTimeOffBlockCard extends StatelessWidget {
  final ProviderCalendarBlockEntity block;

  const ProviderTimeOffBlockCard({super.key, required this.block});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFFB74D)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.pause_circle_rounded,
              color: Color(0xFFE65100),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Khóa lịch nghỉ: ${block.reason ?? 'Bận cá nhân'}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${block.timeRangeFormatted} (${block.durationFormatted})',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFFE65100),
                    fontWeight: FontWeight.w600,
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
