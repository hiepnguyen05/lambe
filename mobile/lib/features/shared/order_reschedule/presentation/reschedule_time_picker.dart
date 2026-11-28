import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/features/customer/booking/presentation/widgets/config/booking_day_picker.dart';
import 'package:mobile/features/customer/booking/presentation/widgets/config/booking_time_slot_grid.dart';

import '../domain/order_reschedule.dart';

String rescheduleTimeLabel(DateTime time) =>
    DateFormat('HH:mm · dd/MM/yyyy').format(vietnamWallTime(time));

Future<DateTime?> pickRescheduleTime(
  BuildContext context, {
  required DateTime now,
  DateTime? current,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => RescheduleTimePickerSheet(now: now, current: current),
  );
}

class RescheduleTimePickerSheet extends StatefulWidget {
  final DateTime now;
  final DateTime? current;

  const RescheduleTimePickerSheet({
    super.key,
    required this.now,
    this.current,
  });

  @override
  State<RescheduleTimePickerSheet> createState() =>
      _RescheduleTimePickerSheetState();
}

class _RescheduleTimePickerSheetState extends State<RescheduleTimePickerSheet> {
  static const _primaryTeal = Color(0xFF0F766E);

  late DateTime _baseWallDay;
  late DateTime _selectedDay;
  late int _selectedHour;
  late int _selectedMinute;
  int _activePeriod = 0; // 0: Sáng, 1: Chiều, 2: Tối

  @override
  void initState() {
    super.initState();
    final nowWall = vietnamWallTime(widget.now);
    _baseWallDay = DateTime(nowWall.year, nowWall.month, nowWall.day);

    final minLead = widget.now.add(const Duration(minutes: 65));
    var initial = widget.current ?? minLead;
    if (validateRescheduleTime(initial, widget.now, widget.current) != null) {
      initial = minLead;
    }

    final initialWall = vietnamWallTime(initial);
    _selectedDay = DateTime(
      initialWall.year,
      initialWall.month,
      initialWall.day,
    );
    _selectedHour = initialWall.hour;
    _selectedMinute = ((initialWall.minute + 29) ~/ 30) * 30;
    if (_selectedMinute >= 60) {
      _selectedHour += 1;
      _selectedMinute = 0;
    }
    if (_selectedHour < 7) {
      _selectedHour = 7;
      _selectedMinute = 0;
    } else if (_selectedHour > 22 ||
        (_selectedHour == 22 && _selectedMinute > 0)) {
      final tomorrow = _baseWallDay.add(const Duration(days: 1));
      _selectedDay = tomorrow;
      _selectedHour = 7;
      _selectedMinute = 0;
    }

    _ensureValidSelectedSlot();
  }

  void _syncPeriodWithSelectedHour() {
    if (_selectedHour < 12) {
      _activePeriod = 0;
    } else if (_selectedHour < 18) {
      _activePeriod = 1;
    } else {
      _activePeriod = 2;
    }
  }

  bool _isSlotSelectable(DateTime day, int hour, int minute) {
    final candidateUtc = fromVietnamWallTime(day, hour, minute);
    return validateRescheduleTime(candidateUtc, widget.now, widget.current) ==
        null;
  }

  void _ensureValidSelectedSlot() {
    if (!_isSlotSelectable(_selectedDay, _selectedHour, _selectedMinute)) {
      final allDaySlots = _allSlotsForDay(_selectedDay);
      final firstValid = allDaySlots.where((s) => s.isAvailable).firstOrNull;
      if (firstValid != null) {
        _selectedHour = firstValid.hour;
        _selectedMinute = firstValid.minute;
      } else {
        final nextDay = _selectedDay.add(const Duration(days: 1));
        final maxDay = _baseWallDay.add(const Duration(days: 30));
        if (!nextDay.isAfter(maxDay)) {
          _selectedDay = nextDay;
          final nextSlots = _allSlotsForDay(nextDay);
          final nextValid = nextSlots.where((s) => s.isAvailable).firstOrNull;
          if (nextValid != null) {
            _selectedHour = nextValid.hour;
            _selectedMinute = nextValid.minute;
          }
        }
      }
    }
    _syncPeriodWithSelectedHour();
  }

  List<BookingTimeSlot> _allSlotsForDay(DateTime day) => [
    ..._generateSlotsForRange(day, 7, 0, 11, 30),
    ..._generateSlotsForRange(day, 12, 0, 17, 30),
    ..._generateSlotsForRange(day, 18, 0, 22, 0),
  ];

  List<BookingTimeSlot> _generateSlotsForRange(
    DateTime day,
    int startHour,
    int startMin,
    int endHour,
    int endMin,
  ) {
    final slots = <BookingTimeSlot>[];
    var currentMinutes = startHour * 60 + startMin;
    final endMinutes = endHour * 60 + endMin;
    while (currentMinutes <= endMinutes) {
      final hour = currentMinutes ~/ 60;
      final min = currentMinutes % 60;
      slots.add(
        BookingTimeSlot(
          hour: hour,
          minute: min,
          isAvailable: _isSlotSelectable(day, hour, min),
        ),
      );
      currentMinutes += 30;
    }
    return slots;
  }

  DateTime? get _selectedInstant {
    if (!_isSlotSelectable(_selectedDay, _selectedHour, _selectedMinute)) {
      return null;
    }
    return fromVietnamWallTime(_selectedDay, _selectedHour, _selectedMinute);
  }

  String _formatHourMinute(int hour, int minute) {
    final h = hour.toString().padLeft(2, '0');
    final m = minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  @override
  Widget build(BuildContext context) {
    final selectedInstant = _selectedInstant;
    final activeSlots = switch (_activePeriod) {
      0 => _generateSlotsForRange(_selectedDay, 7, 0, 11, 30),
      1 => _generateSlotsForRange(_selectedDay, 12, 0, 17, 30),
      _ => _generateSlotsForRange(_selectedDay, 18, 0, 22, 0),
    };
    final hasAvailableInPeriod = activeSlots.any((s) => s.isAvailable);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.event_repeat_rounded,
                    color: _primaryTeal,
                    size: 19,
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Đề xuất giờ mới',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      Text(
                        'Chọn ngày và khung giờ (giờ Việt Nam UTC+07:00)',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            if (widget.current != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.schedule_rounded,
                      size: 15,
                      color: Color(0xFF64748B),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Lịch hiện tại: ${rescheduleTimeLabel(widget.current!)}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            const Text(
              'Chọn ngày',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 8),
            BookingDayPicker(
              selectedDay: _selectedDay,
              dayCount: 31,
              baseDate: _baseWallDay,
              onDaySelected: (day) {
                setState(() {
                  _selectedDay = day;
                  _ensureValidSelectedSlot();
                });
              },
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Text(
                  'Chọn khung giờ',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF334155),
                  ),
                ),
                const Spacer(),
                if (selectedInstant != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6F5),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Đã chọn: ${_formatHourMinute(_selectedHour, _selectedMinute)} · ${DateFormat('dd/MM').format(_selectedDay)}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: _primaryTeal,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            _buildPeriodTabs(),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                final itemWidth = (constraints.maxWidth - 24) / 4;
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: activeSlots.map((slot) {
                    final isSelected =
                        slot.hour == _selectedHour &&
                        slot.minute == _selectedMinute &&
                        slot.isAvailable;
                    return SizedBox(
                      width: itemWidth,
                      child: InkWell(
                        onTap: slot.isAvailable
                            ? () {
                                setState(() {
                                  _selectedHour = slot.hour;
                                  _selectedMinute = slot.minute;
                                });
                              }
                            : null,
                        borderRadius: BorderRadius.circular(10),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? _primaryTeal
                                : (slot.isAvailable
                                      ? const Color(0xFFF8FAFC)
                                      : const Color(0xFFF1F5F9)),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected
                                  ? _primaryTeal
                                  : (slot.isAvailable
                                        ? const Color(0xFFE2E8F0)
                                        : const Color(
                                            0xFFE2E8F0,
                                          ).withValues(alpha: 0.5)),
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            slot.formatted,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isSelected
                                  ? FontWeight.w700
                                  : FontWeight.w600,
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
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            if (!hasAvailableInPeriod) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 14,
                      color: Color(0xFFD97706),
                    ),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Các khung giờ buổi này chưa hợp lệ (cần sau hiện tại ít nhất 60 phút và khác lịch cũ).',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Quay lại'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: selectedInstant == null
                        ? null
                        : () => Navigator.of(context).pop(selectedInstant),
                    style: FilledButton.styleFrom(
                      backgroundColor: _primaryTeal,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Xác nhận khung giờ',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPeriodTabs() {
    const periods = [
      {'label': 'Sáng', 'time': '07:00 - 11:30', 'icon': Icons.wb_sunny_rounded},
      {
        'label': 'Chiều',
        'time': '12:00 - 17:30',
        'icon': Icons.wb_twilight_rounded,
      },
      {'label': 'Tối', 'time': '18:00 - 22:00', 'icon': Icons.nightlight_round},
    ];

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: List.generate(periods.length, (index) {
          final isSelected = _activePeriod == index;
          final item = periods[index];
          return Expanded(
            child: InkWell(
              onTap: () => setState(() => _activePeriod = index),
              borderRadius: BorderRadius.circular(9),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ]
                      : null,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          item['icon'] as IconData,
                          size: 13,
                          color: isSelected
                              ? _primaryTeal
                              : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          item['label'] as String,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w600,
                            color: isSelected
                                ? _primaryTeal
                                : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item['time'] as String,
                      style: TextStyle(
                        fontSize: 10,
                        color: isSelected
                            ? _primaryTeal.withValues(alpha: 0.8)
                            : const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
