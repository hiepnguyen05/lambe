import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../../domain/entities/provider_working_hour_entity.dart';
import '../../../di/provider_schedule_providers.dart';
import './schedule_day_card.dart';

class WeeklyShiftTab extends ConsumerWidget {
  const WeeklyShiftTab({super.key});

  Future<void> _pickTime({
    required BuildContext context,
    required WidgetRef ref,
    required ProviderWorkingHourEntity hour,
    required bool isStart,
  }) async {
    final initialMinutes = isStart ? hour.startMinute : hour.endMinute;
    final initialTime = TimeOfDay(
      hour: initialMinutes ~/ 60,
      minute: initialMinutes % 60,
    );

    final picked = await showTimePicker(
      context: context,
      initialTime: initialTime,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: AppColors.onPrimary,
              surface: AppColors.surfaceContainerLowest,
              onSurface: AppColors.onSurface,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final pickedMinutes = picked.hour * 60 + picked.minute;
      final startMin = isStart ? pickedMinutes : hour.startMinute;
      final endMin = isStart ? hour.endMinute : pickedMinutes;

      if (endMin <= startMin) {
        if (context.mounted) {
          AppDialog.warning(
            context,
            message: 'Giờ kết thúc ca phải sau giờ bắt đầu!',
          );
        }
        return;
      }

      ref
          .read(providerScheduleNotifierProvider.notifier)
          .updateDayHours(hour.dayOfWeek, startMin, endMin);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerScheduleNotifierProvider);
    final notifier = ref.read(providerScheduleNotifierProvider.notifier);
    final theme = Theme.of(context);

    if (state.setup.isLoading && state.draftWorkingHours.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => notifier.loadSetup(),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              children: [
                // Insight / Tip Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6F4F1),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.lightbulb_outline_rounded,
                        color: AppColors.primary,
                        size: 22,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Khuyên dùng: Khung giờ nhận việc tối',
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Khách thường đặt dịch vụ tại nhà từ 17:00 - 21:00. Hãy duy trì giờ kết thúc tối thiểu 21:00 để luôn sẵn sàng nhận đơn đặt ngay hoặc hẹn trước.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.onSurfaceVariant,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Metrics summary
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        title: 'Số ngày làm việc',
                        value: '${state.workingDaysCount} / 7 ngày',
                        icon: Icons.calendar_today_rounded,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        title: 'Tổng giờ trong tuần',
                        value:
                            '${state.totalWeeklyHours.toStringAsFixed(1)} giờ',
                        icon: Icons.schedule_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Presets selector
                Text(
                  'Mẫu khung giờ phổ biến',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _PresetChip(
                        label: 'Cả tuần (08:00 - 21:00) ⭐',
                        isRecommended: true,
                        onTap: () => notifier.applyPreset('FULL_WEEK_EXTENDED'),
                      ),
                      const SizedBox(width: 8),
                      _PresetChip(
                        label: 'Chuẩn (08:00 - 18:00)',
                        onTap: () => notifier.applyPreset('STANDARD_WEEK'),
                      ),
                      const SizedBox(width: 8),
                      _PresetChip(
                        label: 'Ca tối (09:00 - 22:00)',
                        onTap: () => notifier.applyPreset('FULL_DAY_MAX'),
                      ),
                      const SizedBox(width: 8),
                      _PresetChip(
                        label: 'Hành chính (T2 - T6)',
                        onTap: () => notifier.applyPreset('OFFICE_HOURS'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Schedule Days
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Chi tiết theo từng ngày',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.onSurface,
                      ),
                    ),
                    if (state.hasUnsavedChanges)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFFB74D)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.edit_note_rounded,
                              size: 14,
                              color: Color(0xFFE65100),
                            ),
                            SizedBox(width: 4),
                            Text(
                              'Chưa lưu thay đổi',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFE65100),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                ...state.draftWorkingHours.map((hour) {
                  return ScheduleDayCard(
                    hour: hour,
                    onToggle: (val) => notifier.toggleDay(hour.dayOfWeek, val),
                    onPickStartTime: () => _pickTime(
                      context: context,
                      ref: ref,
                      hour: hour,
                      isStart: true,
                    ),
                    onPickEndTime: () => _pickTime(
                      context: context,
                      ref: ref,
                      hour: hour,
                      isStart: false,
                    ),
                  );
                }),

                const SizedBox(height: 80),
              ],
            ),
          ),
        ),

        // Bottom Sticky Save Button
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerLowest,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 10,
                offset: const Offset(0, -3),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: state.isSaving
                    ? null
                    : () async {
                        final success = await notifier.saveWorkingHours();
                        if (context.mounted && success) {
                          AppDialog.success(
                            context,
                            message: 'Đã lưu lịch làm việc thành công!',
                          );
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 2,
                ),
                child: state.isSaving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.save_rounded, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Lưu lịch làm việc tuần',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;

  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.outline,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
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

class _PresetChip extends StatelessWidget {
  final String label;
  final bool isRecommended;
  final VoidCallback onTap;

  const _PresetChip({
    required this.label,
    this.isRecommended = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      onPressed: onTap,
      label: Text(label),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isRecommended ? FontWeight.bold : FontWeight.w500,
        color: isRecommended ? AppColors.primary : AppColors.onSurface,
      ),
      backgroundColor: isRecommended
          ? AppColors.primary.withValues(alpha: 0.1)
          : AppColors.surfaceContainerLow,
      side: BorderSide(
        color: isRecommended
            ? AppColors.primary.withValues(alpha: 0.4)
            : AppColors.outlineVariant.withValues(alpha: 0.5),
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }
}
