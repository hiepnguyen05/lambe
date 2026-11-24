import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class TimeOffDatePickerField extends StatelessWidget {
  final DateTime selectedDate;
  final VoidCallback onTap;

  const TimeOffDatePickerField({
    super.key,
    required this.selectedDate,
    required this.onTap,
  });

  String _formatDate(DateTime d) {
    final dayStr = d.day.toString().padLeft(2, '0');
    final monthStr = d.month.toString().padLeft(2, '0');
    return '$dayStr/$monthStr/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
              Icons.calendar_today_rounded,
              size: 18,
              color: AppColors.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _formatDate(selectedDate),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Icon(Icons.arrow_drop_down_rounded, color: AppColors.outline),
          ],
        ),
      ),
    );
  }
}

class TimeOffTimeRangeSelector extends StatelessWidget {
  final TimeOfDay startTime;
  final TimeOfDay endTime;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;

  const TimeOffTimeRangeSelector({
    super.key,
    required this.startTime,
    required this.endTime,
    required this.onPickStart,
    required this.onPickEnd,
  });

  String _formatTime(TimeOfDay t) {
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: onPickStart,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.outlineVariant.withValues(alpha: 0.5),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Từ giờ',
                    style: TextStyle(fontSize: 11, color: AppColors.outline),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatTime(startTime),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 10),
          child: Icon(
            Icons.arrow_forward_rounded,
            color: AppColors.outline,
            size: 20,
          ),
        ),
        Expanded(
          child: InkWell(
            onTap: onPickEnd,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.outlineVariant.withValues(alpha: 0.5),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Đến giờ',
                    style: TextStyle(fontSize: 11, color: AppColors.outline),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatTime(endTime),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class TimeOffReasonPresets extends StatelessWidget {
  final List<String> presets;
  final String currentReason;
  final ValueChanged<String> onSelect;

  const TimeOffReasonPresets({
    super.key,
    required this.presets,
    required this.currentReason,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: presets.map((r) {
        final isSelected = currentReason == r;
        return ChoiceChip(
          label: Text(r),
          selected: isSelected,
          selectedColor: AppColors.primary.withValues(alpha: 0.15),
          backgroundColor: AppColors.surfaceContainerLow,
          labelStyle: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? AppColors.primary : AppColors.onSurface,
          ),
          side: BorderSide(
            color: isSelected
                ? AppColors.primary
                : AppColors.outlineVariant.withValues(alpha: 0.4),
          ),
          onSelected: (selected) {
            if (selected) {
              onSelect(r);
            }
          },
        );
      }).toList(),
    );
  }
}
