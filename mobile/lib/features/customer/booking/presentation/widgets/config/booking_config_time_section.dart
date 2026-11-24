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
      // Hết khung giờ hôm nay -> mặc định chuyển sang ngày mai 07:00
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
        // Hôm nay không còn khung giờ khả dụng: tự động chọn ngày mai lúc 07:00
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
          // Vượt quá giờ làm việc tối -> chuyển sang sáng mai
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

  @override
  Widget build(BuildContext context) {
    final isAsap = widget.draft.bookingType == BookingType.asap;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
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
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // ASAP vs SCHEDULED Toggle
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(14),
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
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isAsap ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: isAsap
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.bolt_rounded,
                            size: 18,
                            color: isAsap
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Đặt ngay',
                            style: TextStyle(
                              fontSize: 14,
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
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: !isAsap ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: !isAsap
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.calendar_month_rounded,
                            size: 18,
                            color: !isAsap
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Đặt lịch hẹn',
                            style: TextStyle(
                              fontSize: 14,
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
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Color(0xFFEFF6F5),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.bolt_rounded,
                      color: Color(0xFF0F766E),
                      size: 20,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Phục vụ ngay tức thì',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B1C30),
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Chuyên viên sẵn sàng tiếp nhận và xuất phát ngay đến địa chỉ của bạn. Làm đẹp tại nhà tức thì, không cần chờ đợi.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF64748B),
                            height: 1.4,
                          ),
                        ),
                        SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: const [
                            Icon(
                              Icons.bolt_rounded,
                              size: 15,
                              color: Color(0xFF0F766E),
                            ),
                            SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                'Xuất phát ngay • Có mặt sau 15 – 30 phút',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ),
                          ],
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
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 10),

            BookingDayPicker(
              selectedDay: _selectedDay,
              onDaySelected: _onDaySelected,
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                const Text(
                  'Chọn khung giờ',
                  style: TextStyle(
                    fontSize: 13.5,
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
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Sáng: 07:00 - 11:30
            BookingTimePeriodSection(
              title: 'Buổi Sáng',
              timeRange: '07:00 - 11:30',
              icon: Icons.wb_sunny_rounded,
              iconColor: const Color(0xFFF59E0B),
              slots: _generateSlotsForRange(7, 0, 11, 30),
              selectedHour: _selectedHour,
              selectedMinute: _selectedMinute,
              onSelect: _onTimeSelected,
            ),
            const SizedBox(height: 16),

            // Chiều: 12:00 - 17:30
            BookingTimePeriodSection(
              title: 'Buổi Chiều',
              timeRange: '12:00 - 17:30',
              icon: Icons.wb_twilight_rounded,
              iconColor: const Color(0xFF0F766E),
              slots: _generateSlotsForRange(12, 0, 17, 30),
              selectedHour: _selectedHour,
              selectedMinute: _selectedMinute,
              onSelect: _onTimeSelected,
            ),
            const SizedBox(height: 16),

            // Tối: 18:00 - 22:00
            BookingTimePeriodSection(
              title: 'Buổi Tối',
              timeRange: '18:00 - 22:00',
              icon: Icons.nightlight_round,
              iconColor: const Color(0xFF6366F1),
              slots: _generateSlotsForRange(18, 0, 22, 0),
              selectedHour: _selectedHour,
              selectedMinute: _selectedMinute,
              onSelect: _onTimeSelected,
            ),
          ],
        ],
      ),
    );
  }
}
