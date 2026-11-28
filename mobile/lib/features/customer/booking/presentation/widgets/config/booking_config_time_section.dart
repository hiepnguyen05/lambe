import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/booking_draft_entity.dart';
import '../../providers/booking_draft_provider.dart';
import './booking_day_picker.dart';
import './booking_time_slot_grid.dart';

class BookingConfigTimeSection extends ConsumerStatefulWidget {
  final BookingDraftEntity draft;

  const BookingConfigTimeSection({super.key, required this.draft});

  @override
  ConsumerState<BookingConfigTimeSection> createState() =>
      _BookingConfigTimeSectionState();
}

class _BookingConfigTimeSectionState
    extends ConsumerState<BookingConfigTimeSection> {
  late DateTime _selectedDay;
  late int _selectedHour;
  late int _selectedMinute;
  int _activePeriod = 0; // 0: Sáng, 1: Chiều, 2: Tối

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final minLeadTime = now.add(const Duration(minutes: 60));
    final todayEnd = DateTime(now.year, now.month, now.day, 22, 0);

    DateTime initialDate;
    if (widget.draft.scheduledAt != null) {
      initialDate = widget.draft.scheduledAt!;
    } else if (minLeadTime.isAfter(todayEnd)) {
      final tomorrow = now.add(const Duration(days: 1));
      initialDate = DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 7, 0);
    } else {
      initialDate = now.add(const Duration(minutes: 90));
    }

    _selectedDay = DateTime(
      initialDate.year,
      initialDate.month,
      initialDate.day,
    );
    _selectedHour = initialDate.hour;
    _selectedMinute = (initialDate.minute ~/ 30) * 30;
    if (_selectedHour < 7) {
      _selectedHour = 7;
      _selectedMinute = 0;
    } else if (_selectedHour > 22 ||
        (_selectedHour == 22 && _selectedMinute > 0)) {
      _selectedHour = 22;
      _selectedMinute = 0;
    }

    _syncPeriodWithSelectedHour();
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

  @override
  void didUpdateWidget(covariant BookingConfigTimeSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.draft.scheduledAt != null &&
        oldWidget.draft.scheduledAt != widget.draft.scheduledAt) {
      final dt = widget.draft.scheduledAt!;
      _selectedDay = DateTime(dt.year, dt.month, dt.day);
      _selectedHour = dt.hour;
      _selectedMinute = (dt.minute ~/ 30) * 30;
      _syncPeriodWithSelectedHour();
    }
  }

  void _onDaySelected(DateTime day) {
    setState(() {
      _selectedDay = day;
      _recalculateScheduledDateTime();
    });
  }

  void _onTimeSelected(int hour, int minute) {
    setState(() {
      _selectedHour = hour;
      _selectedMinute = minute;
      _recalculateScheduledDateTime();
    });
  }

  void _recalculateScheduledDateTime() {
    final now = DateTime.now();
    var scheduled = DateTime(
      _selectedDay.year,
      _selectedDay.month,
      _selectedDay.day,
      _selectedHour,
      _selectedMinute,
    );

    final minLeadTime = now.add(const Duration(minutes: 60));
    final todayEnd = DateTime(now.year, now.month, now.day, 22, 0);

    if (BookingDayPicker.isSameDay(_selectedDay, now)) {
      if (minLeadTime.isAfter(todayEnd)) {
        final tomorrow = now.add(const Duration(days: 1));
        _selectedDay = DateTime(tomorrow.year, tomorrow.month, tomorrow.day);
        _selectedHour = 7;
        _selectedMinute = 0;
        scheduled = DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 7, 0);
      } else if (scheduled.isBefore(minLeadTime)) {
        final nextMinute = ((minLeadTime.minute ~/ 30) + 1) * 30;
        int nextHour = minLeadTime.hour;
        int targetMin = nextMinute;
        if (nextMinute >= 60) {
          nextHour += 1;
          targetMin = 0;
        }
        if (nextHour < 7) {
          nextHour = 7;
          targetMin = 0;
        } else if (nextHour > 22 || (nextHour == 22 && targetMin > 0)) {
          final tomorrow = now.add(const Duration(days: 1));
          _selectedDay = DateTime(tomorrow.year, tomorrow.month, tomorrow.day);
          nextHour = 7;
          targetMin = 0;
        }
        _selectedHour = nextHour;
        _selectedMinute = targetMin;

        scheduled = DateTime(
          _selectedDay.year,
          _selectedDay.month,
          _selectedDay.day,
          _selectedHour,
          _selectedMinute,
        );
      }
    }

    _syncPeriodWithSelectedHour();
    ref.read(bookingDraftProvider.notifier).setScheduledAt(scheduled);
  }

  List<BookingTimeSlot> _generateSlotsForRange(
    int startHour,
    int startMin,
    int endHour,
    int endMin,
  ) {
    final slots = <BookingTimeSlot>[];
    final now = DateTime.now();
    final isToday = BookingDayPicker.isSameDay(_selectedDay, now);
    final minLeadTime = now.add(const Duration(minutes: 60));

    var currentMinutes = startHour * 60 + startMin;
    final endMinutes = endHour * 60 + endMin;

    while (currentMinutes <= endMinutes) {
      final hour = currentMinutes ~/ 60;
      final min = currentMinutes % 60;

      final slotDateTime = DateTime(
        _selectedDay.year,
        _selectedDay.month,
        _selectedDay.day,
        hour,
        min,
      );

      final isAvailable = !isToday || slotDateTime.isAfter(minLeadTime);
      slots.add(
        BookingTimeSlot(hour: hour, minute: min, isAvailable: isAvailable),
      );

      currentMinutes += 30;
    }
    return slots;
  }

  String _formatHourMinute(int hour, int minute) {
    final h = hour.toString().padLeft(2, '0');
    final m = minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Widget _buildPeriodTabs() {
    const periods = [
      {'label': 'Sáng', 'time': '07:00 - 11:30', 'icon': Icons.wb_sunny_rounded},
      {'label': 'Chiều', 'time': '12:00 - 17:30', 'icon': Icons.wb_twilight_rounded},
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
              onTap: () {
                setState(() {
                  _activePeriod = index;
                });
              },
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
                              ? const Color(0xFF0F766E)
                              : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          item['label'] as String,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                            color: isSelected
                                ? const Color(0xFF0F766E)
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
                            ? const Color(0xFF0F766E).withValues(alpha: 0.8)
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

  Widget _buildSlotsGrid(List<BookingTimeSlot> slots) {
    if (slots.isEmpty) return const SizedBox.shrink();

    final hasAvailable = slots.any((s) => s.isAvailable);

    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - 24) / 4; // 4 columns with 8px spacing
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: slots.map((slot) {
                final isSelected =
                    slot.hour == _selectedHour &&
                    slot.minute == _selectedMinute &&
                    slot.isAvailable;

                return SizedBox(
                  width: itemWidth,
                  child: InkWell(
                    onTap: slot.isAvailable
                        ? () => _onTimeSelected(slot.hour, slot.minute)
                        : null,
                    borderRadius: BorderRadius.circular(10),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(vertical: 9),
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
                              : (slot.isAvailable
                                  ? const Color(0xFFE2E8F0)
                                  : const Color(0xFFE2E8F0).withValues(alpha: 0.5)),
                          width: isSelected ? 1.5 : 1,
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF0F766E).withValues(alpha: 0.2),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        slot.formatted,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w600,
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
            ),
            if (!hasAvailable) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  children: const [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 14,
                      color: Color(0xFFD97706),
                    ),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Các khung giờ buổi này đã qua, vui lòng chọn buổi khác hoặc ngày tiếp theo.',
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
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAsap = widget.draft.bookingType == BookingType.asap;

    final activeSlots = switch (_activePeriod) {
      0 => _generateSlotsForRange(7, 0, 11, 30),
      1 => _generateSlotsForRange(12, 0, 17, 30),
      _ => _generateSlotsForRange(18, 0, 22, 0),
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.access_time_rounded,
                  color: Color(0xFF0F766E),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Thời gian thực hiện',
                style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ASAP vs SCHEDULED Toggle
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () {
                      ref
                          .read(bookingDraftProvider.notifier)
                          .setBookingType(BookingType.asap);
                    },
                    borderRadius: BorderRadius.circular(9),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: isAsap ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                        boxShadow: isAsap
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.bolt_rounded,
                            size: 17,
                            color: isAsap
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Đặt ngay',
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: isAsap
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: isAsap
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      ref
                          .read(bookingDraftProvider.notifier)
                          .setBookingType(BookingType.scheduled);
                      _recalculateScheduledDateTime();
                    },
                    borderRadius: BorderRadius.circular(9),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: !isAsap ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                        boxShadow: !isAsap
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.calendar_month_rounded,
                            size: 17,
                            color: !isAsap
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Đặt lịch hẹn',
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight: !isAsap
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: !isAsap
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (isAsap)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6F5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFF99F6E4).withValues(alpha: 0.6),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F766E),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: const Icon(
                      Icons.bolt_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Phục vụ ngay tức thì',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B1C30),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Chuyên viên gần nhất tiếp nhận và có mặt sau 15 – 30 phút.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF475569),
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else ...[
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
              onDaySelected: _onDaySelected,
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
                    'Đã chọn: ${_formatHourMinute(_selectedHour, _selectedMinute)}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            _buildPeriodTabs(),
            const SizedBox(height: 12),

            _buildSlotsGrid(activeSlots),
          ],
        ],
      ),
    );
  }
}
