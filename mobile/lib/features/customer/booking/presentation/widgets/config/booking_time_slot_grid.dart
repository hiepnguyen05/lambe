import 'package:flutter/material.dart';

class BookingTimeSlot {
  final int hour;
  final int minute;
  final bool isAvailable;

  const BookingTimeSlot({
    required this.hour,
    required this.minute,
    required this.isAvailable,
  });

  String get formatted {
    final h = hour.toString().padLeft(2, '0');
    final m = minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class BookingTimePeriodSection extends StatelessWidget {
  final String title;
  final String timeRange;
  final IconData icon;
  final Color iconColor;
  final List<BookingTimeSlot> slots;
  final int selectedHour;
  final int selectedMinute;
  final void Function(int hour, int minute) onSelect;

  const BookingTimePeriodSection({
    super.key,
    required this.title,
    required this.timeRange,
    required this.icon,
    required this.iconColor,
    required this.slots,
    required this.selectedHour,
    required this.selectedMinute,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 15, color: iconColor),
            const SizedBox(width: 6),
            Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '($timeRange)',
              style: const TextStyle(
                fontSize: 11.5,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: slots.map((slot) {
            final isSelected =
                slot.hour == selectedHour &&
                slot.minute == selectedMinute &&
                slot.isAvailable;

            return InkWell(
              onTap: slot.isAvailable
                  ? () => onSelect(slot.hour, slot.minute)
                  : null,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFF0F766E)
                      : (slot.isAvailable
                            ? const Color(0xFFF8FAFC)
                            : const Color(0xFFF1F5F9)),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFF0F766E)
                        : const Color(0xFFE2E8F0),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Text(
                  slot.formatted,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                    color: isSelected
                        ? Colors.white
                        : (slot.isAvailable
                              ? const Color(0xFF0B1C30)
                              : const Color(0xFF94A3B8)),
                    decoration: slot.isAvailable
                        ? null
                        : TextDecoration.lineThrough,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
