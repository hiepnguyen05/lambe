import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

class PartnerQuickStatsGrid extends StatelessWidget {
  final int? completedBookings;
  final double? acceptanceRate;
  final double? onTimeRate;

  const PartnerQuickStatsGrid({
    super.key,
    required this.completedBookings,
    required this.acceptanceRate,
    required this.onTimeRate,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            context: context,
            icon: Icons.task_alt_rounded,
            value: completedBookings?.toString() ?? '--',
            valueColor: AppColors.onSurface,
            label: 'Đơn xong',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildStatCard(
            context: context,
            icon: Icons.handshake_outlined,
            value: acceptanceRate == null ? '--' : '$acceptanceRate%',
            valueColor: AppColors.primary,
            label: 'Nhận đơn',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildStatCard(
            context: context,
            icon: Icons.schedule_rounded,
            value: onTimeRate == null ? '--' : '${onTimeRate!.toInt()}%',
            valueColor: AppColors.secondary,
            label: 'Đúng giờ',
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard({
    required BuildContext context,
    required IconData icon,
    required String value,
    required Color valueColor,
    required String label,
  }) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: const BoxDecoration(
              color: AppColors.surfaceContainer,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: AppColors.primary),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 17,
              color: valueColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: AppColors.onSurfaceVariant,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
