import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../domain/order_reschedule.dart';

String rescheduleTimeLabel(DateTime time) =>
    DateFormat('HH:mm · dd/MM/yyyy').format(vietnamWallTime(time));

Future<DateTime?> pickRescheduleTime(
  BuildContext context, {
  required DateTime now,
  DateTime? current,
}) async {
  final first = vietnamWallTime(now);
  final last = vietnamWallTime(now.add(const Duration(days: 30)));
  var initial = current ?? now.add(const Duration(minutes: 65));
  if (validateRescheduleTime(initial, now, null) != null) {
    initial = now.add(const Duration(minutes: 65));
  }
  final wall = vietnamWallTime(initial);
  final date = await showDatePicker(
    context: context,
    helpText: 'Chọn ngày · giờ Việt Nam (UTC+07:00)',
    initialDate: DateTime(wall.year, wall.month, wall.day),
    firstDate: DateTime(first.year, first.month, first.day),
    lastDate: DateTime(last.year, last.month, last.day),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    helpText: 'Giờ Việt Nam (UTC+07:00)',
    initialTime: TimeOfDay(hour: wall.hour, minute: wall.minute),
  );
  if (time == null || !context.mounted) return null;
  return fromVietnamWallTime(date, time.hour, time.minute);
}
