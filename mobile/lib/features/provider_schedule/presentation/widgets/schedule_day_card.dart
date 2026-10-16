import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/provider_working_hour_entity.dart';

class ScheduleDayCard extends StatelessWidget {
  final ProviderWorkingHourEntity hour;
  final ValueChanged<bool> onToggle;
  final VoidCallback onPickStartTime;
  final VoidCallback onPickEndTime;

  const ScheduleDayCard({
    super.key,
    required this.hour,
    required this.onToggle,
    required this.onPickStartTime,
    required this.onPickEndTime,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWorking = hour.isWorking;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isWorking
            ? AppColors.surfaceContainerLowest
            : AppColors.surfaceContainerLow.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isWorking
              ? AppColors.primary.withValues(alpha: 0.25)
              : AppColors.outlineVariant.withValues(alpha: 0.4),
          width: isWorking ? 1.5 : 1,
        ),
        boxShadow: isWorking
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Short badge, Day name, Switch
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: isWorking
                        ? AppColors.primary.withValues(alpha: 0.1)
                        : AppColors.outlineVariant.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    hour.shortDayName,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color:
                          isWorking ? AppColors.primary : AppColors.outline,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        hour.dayName,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: isWorking
                              ? AppColors.onSurface
                              : AppColors.outline,
                        ),
                      ),
                      Text(
                        isWorking
                            ? '${hour.workingHoursCount.toStringAsFixed(1)} giờ làm việc'
                            : 'Nghỉ ngơi - Không nhận đơn',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: isWorking
                              ? AppColors.primary
                              : AppColors.outline,
                          fontWeight:
                              isWorking ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch.adaptive(
                  value: isWorking,
                  activeThumbColor: AppColors.primary,
                  activeTrackColor: AppColors.primary.withValues(alpha: 0.4),
                  onChanged: onToggle,
                ),
              ],
            ),

            if (isWorking) ...[
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.outlineVariant),
              const SizedBox(height: 14),

              // Time pickers row
              Row(
                children: [
                  Expanded(
                    child: _TimeBox(
                      label: 'Bắt đầu',
                      time: hour.startTimeFormatted,
                      onTap: onPickStartTime,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Icon(
                      Icons.arrow_forward_rounded,
                      color: AppColors.outline,
                      size: 20,
                    ),
                  ),
                  Expanded(
                    child: _TimeBox(
                      label: 'Kết thúc',
                      time: hour.endTimeFormatted,
                      onTap: onPickEndTime,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TimeBox extends StatelessWidget {
  final String label;
  final String time;
  final VoidCallback onTap;

  const _TimeBox({
    required this.label,
    required this.time,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppColors.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.access_time_rounded,
              size: 18,
              color: AppColors.primary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.outline,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    time,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurface,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.edit_calendar_outlined,
              size: 16,
              color: AppColors.outline,
            ),
          ],
        ),
      ),
    );
  }
}
