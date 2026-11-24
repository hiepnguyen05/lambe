import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../../di/provider_schedule_providers.dart';
import './time_off_form_fields.dart';

class AddTimeOffBottomSheet extends ConsumerStatefulWidget {
  const AddTimeOffBottomSheet({super.key});

  @override
  ConsumerState<AddTimeOffBottomSheet> createState() =>
      _AddTimeOffBottomSheetState();
}

class _AddTimeOffBottomSheetState extends ConsumerState<AddTimeOffBottomSheet> {
  late DateTime _selectedDate;
  late TimeOfDay _startTime;
  late TimeOfDay _endTime;
  final TextEditingController _reasonController = TextEditingController();

  final List<String> _reasonPresets = [
    'Nghỉ ngơi / Ăn trưa',
    'Bận việc gia đình',
    'Khám sức khỏe',
    'Bận việc đột xuất',
    'Bảo dưỡng dụng cụ',
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedDate = DateTime(now.year, now.month, now.day);

    final currentHour = now.hour < 22 ? now.hour + 1 : 12;
    _startTime = TimeOfDay(hour: currentHour, minute: 0);
    _endTime = TimeOfDay(hour: (currentHour + 1) % 24, minute: 0);
    _reasonController.text = _reasonPresets[0];
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final maxDate = today.add(const Duration(days: 30));

    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate.isBefore(today) ? today : _selectedDate,
      firstDate: today,
      lastDate: maxDate,
    );

    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
    );

    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(providerScheduleNotifierProvider);
    final notifier = ref.read(providerScheduleNotifierProvider.notifier);
    final theme = Theme.of(context);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFECE0),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.event_busy_rounded,
                    color: Color(0xFFE65100),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Báo bận / Tạo lịch nghỉ',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.onSurface,
                        ),
                      ),
                      const Text(
                        'Hệ thống sẽ không nhận đơn vào khung giờ này',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.outline,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Ngày nghỉ',
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            TimeOffDatePickerField(
              selectedDate: _selectedDate,
              onTap: _pickDate,
            ),
            const SizedBox(height: 16),
            Text(
              'Khoảng thời gian nghỉ (Tối thiểu 15 phút)',
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            TimeOffTimeRangeSelector(
              startTime: _startTime,
              endTime: _endTime,
              onPickStart: () => _pickTime(isStart: true),
              onPickEnd: () => _pickTime(isStart: false),
            ),
            const SizedBox(height: 16),
            Text(
              'Lý do nghỉ',
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            TimeOffReasonPresets(
              presets: _reasonPresets,
              currentReason: _reasonController.text,
              onSelect: (reason) {
                setState(() => _reasonController.text = reason);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _reasonController,
              decoration: InputDecoration(
                hintText: 'Nhập hoặc chỉnh sửa lý do nghỉ...',
                filled: true,
                fillColor: AppColors.surfaceContainerLow,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: AppColors.outlineVariant.withValues(alpha: 0.5),
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: AppColors.outlineVariant.withValues(alpha: 0.5),
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                    color: AppColors.primary,
                    width: 1.5,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: state.isSaving
                    ? null
                    : () async {
                        final startDateTime = DateTime(
                          _selectedDate.year,
                          _selectedDate.month,
                          _selectedDate.day,
                          _startTime.hour,
                          _startTime.minute,
                        );
                        final endDateTime = DateTime(
                          _selectedDate.year,
                          _selectedDate.month,
                          _selectedDate.day,
                          _endTime.hour,
                          _endTime.minute,
                        );

                        if (endDateTime.isBefore(startDateTime) ||
                            endDateTime.difference(startDateTime).inMinutes <
                                15) {
                          AppDialog.warning(
                            context,
                            message: 'Giờ kết thúc phải sau giờ bắt đầu ít nhất 15 phút!',
                          );
                          return;
                        }

                        final reason = _reasonController.text.trim();
                        if (reason.length < 3) {
                          AppDialog.warning(
                            context,
                            message:
                                'Vui lòng nhập lý do nghỉ ít nhất 3 ký tự!',
                          );
                          return;
                        }

                        final success = await notifier.createTimeOff(
                          from: startDateTime,
                          to: endDateTime,
                          reason: reason,
                        );

                        if (context.mounted && success) {
                          Navigator.of(context).pop();
                          AppDialog.success(
                            context,
                            message: 'Đã tạo lịch nghỉ thành công!',
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
                    : const Text(
                        'Xác nhận tạo lịch nghỉ',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
