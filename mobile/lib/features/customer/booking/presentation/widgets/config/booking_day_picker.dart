import 'package:flutter/material.dart';

class BookingDayPicker extends StatelessWidget {
  final DateTime selectedDay;
  final ValueChanged<DateTime> onDaySelected;
  final int dayCount;
  final DateTime? baseDate;

  const BookingDayPicker({
    super.key,
    required this.selectedDay,
    required this.onDaySelected,
    this.dayCount = 14,
    this.baseDate,
  });

  static bool isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  static List<DateTime> generateUpcomingDays({
    int count = 14,
    DateTime? baseDate,
  }) {
    final now = baseDate ?? DateTime.now();
    return List.generate(count, (i) {
      final day = now.add(Duration(days: i));
      return DateTime(day.year, day.month, day.day);
    });
  }

  static String formatWeekday(DateTime day) {
    switch (day.weekday) {
      case DateTime.monday:
        return 'T.Hai';
      case DateTime.tuesday:
        return 'T.Ba';
      case DateTime.wednesday:
        return 'T.Tư';
      case DateTime.thursday:
        return 'T.Năm';
      case DateTime.friday:
        return 'T.Sáu';
      case DateTime.saturday:
        return 'T.Bảy';
      case DateTime.sunday:
        return 'C.Nhật';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = baseDate ?? DateTime.now();
    final days = generateUpcomingDays(count: dayCount, baseDate: today);

    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: days.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, idx) {
          final day = days[idx];
          final isSelected = isSameDay(day, selectedDay);
          final isToday = isSameDay(day, today);

          final weekdayLabel = isToday ? 'Hôm nay' : formatWeekday(day);

          return InkWell(
            onTap: () => onDaySelected(day),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 58,
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF0F766E)
                    : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFF0F766E)
                      : const Color(0xFFE2E8F0),
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    weekdayLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected
                          ? Colors.white.withValues(alpha: 0.9)
                          : const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${day.day}',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: isSelected
                          ? Colors.white
                          : const Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
