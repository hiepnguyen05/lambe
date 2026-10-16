import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/provider_working_hour_entity.dart';
import '../../di/provider_schedule_providers.dart';

class CalendarTimelineTab extends ConsumerWidget {
  final VoidCallback onNavigateToShifts;
  final VoidCallback onNavigateToTimeOff;

  const CalendarTimelineTab({
    super.key,
    required this.onNavigateToShifts,
    required this.onNavigateToTimeOff,
  });

  String _getDayOfWeekShort(int weekday) {
    switch (weekday) {
      case DateTime.monday:
        return 'T2';
      case DateTime.tuesday:
        return 'T3';
      case DateTime.wednesday:
        return 'T4';
      case DateTime.thursday:
        return 'T5';
      case DateTime.friday:
        return 'T6';
      case DateTime.saturday:
        return 'T7';
      case DateTime.sunday:
      default:
        return 'CN';
    }
  }

  String _formatFullDate(DateTime date) {
    final dayNames = [
      'Chủ Nhật',
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
    ];
    final dayName = dayNames[date.weekday % 7];
    final d = date.day.toString().padLeft(2, '0');
    final m = date.month.toString().padLeft(2, '0');
    return '$dayName, ngày $d/$m/${date.year}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerScheduleNotifierProvider);
    final notifier = ref.read(providerScheduleNotifierProvider.notifier);
    final theme = Theme.of(context);

    final selectedDate = state.selectedCalendarDate;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    // Days list for the next 14 days
    final days = List.generate(14, (i) => today.add(Duration(days: i)));

    // Find if the provider has configured working hours on this dayOfWeek
    // dayOfWeek in entity: 0 = CN, 1 = T2, ..., 6 = T7
    final dayOfWeekEntityNum = selectedDate.weekday % 7;
    final configuredHour = state.draftWorkingHours.firstWhere(
      (h) => h.dayOfWeek == dayOfWeekEntityNum,
      orElse: () => ProviderWorkingHourEntity(
        dayOfWeek: dayOfWeekEntityNum,
        isWorking: false,
      ),
    );

    final blocks = state.blocksForSelectedDate;
    final appointments = blocks.where((b) => b.isAppointment).toList();
    final timeOffs = blocks.where((b) => b.isTimeOff).toList();

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => notifier.loadCalendar(),
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: 16),
        children: [
          // Horizontal Date Selector
          SizedBox(
            height: 82,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: days.length,
              itemBuilder: (context, index) {
                final date = days[index];
                final isSelected = date.year == selectedDate.year &&
                    date.month == selectedDate.month &&
                    date.day == selectedDate.day;
                final isCurrentDay = date.year == today.year &&
                    date.month == today.month &&
                    date.day == today.day;

                // Check if has blocks on this day
                final hasBlocks = (state.calendarBlocks.value ?? []).any((b) {
                  return b.startAt.year == date.year &&
                      b.startAt.month == date.month &&
                      b.startAt.day == date.day;
                });

                return GestureDetector(
                  onTap: () => notifier.selectDate(date),
                  child: Container(
                    width: 58,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : (isCurrentDay
                                ? AppColors.primary.withValues(alpha: 0.5)
                                : AppColors.outlineVariant
                                    .withValues(alpha: 0.4)),
                        width: isCurrentDay || isSelected ? 1.5 : 1,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color:
                                    AppColors.primary.withValues(alpha: 0.25),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ]
                          : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _getDayOfWeekShort(date.weekday),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isSelected
                                ? AppColors.onPrimary
                                : (isCurrentDay
                                    ? AppColors.primary
                                    : AppColors.outline),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          date.day.toString(),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isSelected
                                ? AppColors.onPrimary
                                : AppColors.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        if (hasBlocks)
                          Container(
                            width: 5,
                            height: 5,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFFE65100),
                            ),
                          )
                        else
                          const SizedBox(height: 5),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Day Header Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.outlineVariant.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.calendar_month_rounded,
                            color: AppColors.primary,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _formatFullDate(selectedDate),
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (configuredHour.isWorking) ...[
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color:
                                    AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Khung giờ làm: ${configuredHour.startTimeFormatted} - ${configuredHour.endTimeFormatted}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              '${configuredHour.workingHoursCount.toStringAsFixed(1)} giờ sẵn sàng',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.outline,
                              ),
                            ),
                          ],
                        ),
                        if (appointments.isNotEmpty || timeOffs.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              if (appointments.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  margin: const EdgeInsets.only(right: 6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE8F5E9),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '${appointments.length} đơn đặt',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF2E7D32),
                                    ),
                                  ),
                                ),
                              if (timeOffs.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF3E0),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '${timeOffs.length} khoảng nghỉ',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ]
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF3E0),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.info_outline_rounded,
                                size: 16,
                                color: Color(0xFFE65100),
                              ),
                              const SizedBox(width: 6),
                              const Expanded(
                                child: Text(
                                  'Ngày nghỉ theo cài đặt tuần. Không nhận đơn.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFE65100),
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: onNavigateToShifts,
                                child: const Text(
                                  'Bật làm',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Timeline summary
                Text(
                  'Diễn biến trong ngày',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 12),

                if (blocks.isEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.outlineVariant.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.check_circle_outline_rounded,
                          color: Color(0xFF2E7D32),
                          size: 40,
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Toàn bộ khung giờ đang rảnh',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.onSurface,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          configuredHour.isWorking
                              ? 'Bạn chưa có lịch hẹn hay lịch nghỉ nào vào ngày này. Sẵn sàng nhận đơn từ khách hàng!'
                              : 'Ngày này đang tắt nhận việc.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.outline,
                          ),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  // List appointments & breaks
                  ...blocks.map((block) {
                    if (block.isAppointment) {
                      final order = block.order;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.4),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.content_cut_rounded,
                                color: AppColors.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          order?.serviceName ??
                                              'Lịch hẹn làm đẹp',
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.onSurface,
                                          ),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 6,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE8F5E9),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          order?.status ?? 'ACCEPTED',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF2E7D32),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Thời gian: ${block.timeRangeFormatted} (${block.durationFormatted})',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  if (order?.bookingType != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Loại đơn: ${order!.bookingType == 'ASAP' ? 'Làm ngay' : 'Đặt hẹn trước'}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.outline,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    } else {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: const Color(0xFFFFB74D),
                          ),
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
                  }),
                ],

                const SizedBox(height: 24),

                // Quick buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onNavigateToTimeOff,
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('Báo bận ngày này'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onNavigateToShifts,
                        icon: const Icon(Icons.tune_rounded, size: 18),
                        label: const Text('Đổi giờ làm tuần'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.onSurface,
                          side: const BorderSide(
                            color: AppColors.outlineVariant,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
