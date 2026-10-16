import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/provider_working_hour_entity.dart';
import '../domain/repositories/provider_schedule_repository.dart';
import 'provider_schedule_state.dart';

class ProviderScheduleNotifier extends StateNotifier<ProviderScheduleState> {
  final ProviderScheduleRepository _repository;

  ProviderScheduleNotifier(this._repository)
      : super(
          ProviderScheduleState(
            selectedCalendarDate: DateTime.now(),
          ),
        ) {
    loadAll();
  }

  static const List<int> orderedDays = [1, 2, 3, 4, 5, 6, 0];

  Future<void> loadAll() async {
    await Future.wait([
      loadSetup(),
      loadCalendar(),
    ]);
  }

  Future<void> loadSetup() async {
    state = state.copyWith(setup: const AsyncLoading());
    try {
      final setup = await _repository.getSetup();
      final draft = _buildDraftFromSetup(setup.workingHours);
      state = state.copyWith(
        setup: AsyncData(setup),
        draftWorkingHours: draft,
      );
    } catch (e, st) {
      state = state.copyWith(
        setup: AsyncError(e, st),
        errorMessage: 'Không thể tải lịch làm việc: ${e.toString()}',
      );
    }
  }

  Future<void> loadCalendar({DateTime? from, DateTime? to}) async {
    state = state.copyWith(calendarBlocks: const AsyncLoading());
    try {
      final now = DateTime.now();
      final startDate = from ?? DateTime(now.year, now.month, now.day);
      final endDate = to ?? startDate.add(const Duration(days: 30));

      final blocks = await _repository.getCalendar(
        from: startDate,
        to: endDate,
      );
      state = state.copyWith(calendarBlocks: AsyncData(blocks));
    } catch (e, st) {
      state = state.copyWith(
        calendarBlocks: AsyncError(e, st),
      );
    }
  }

  List<ProviderWorkingHourEntity> _buildDraftFromSetup(
    List<ProviderWorkingHourEntity> serverHours,
  ) {
    final Map<int, ProviderWorkingHourEntity> map = {
      for (final h in serverHours) h.dayOfWeek: h,
    };

    return orderedDays.map((day) {
      if (map.containsKey(day)) {
        final existing = map[day]!;
        return existing.copyWith(isWorking: true);
      } else {
        // Default unassigned day
        return ProviderWorkingHourEntity(
          dayOfWeek: day,
          startMinute: 480, // 08:00
          endMinute: 1260, // 21:00
          isWorking: false,
        );
      }
    }).toList();
  }

  void toggleDay(int dayOfWeek, bool isWorking) {
    final updated = state.draftWorkingHours.map((h) {
      if (h.dayOfWeek == dayOfWeek) {
        return h.copyWith(isWorking: isWorking);
      }
      return h;
    }).toList();

    state = state.copyWith(draftWorkingHours: updated, clearError: true);
  }

  void updateDayHours(int dayOfWeek, int startMinute, int endMinute) {
    if (endMinute <= startMinute) {
      state = state.copyWith(
        errorMessage: 'Giờ kết thúc phải lớn hơn giờ bắt đầu!',
      );
      return;
    }

    final updated = state.draftWorkingHours.map((h) {
      if (h.dayOfWeek == dayOfWeek) {
        return h.copyWith(
          startMinute: startMinute,
          endMinute: endMinute,
          isWorking: true,
        );
      }
      return h;
    }).toList();

    state = state.copyWith(draftWorkingHours: updated, clearError: true);
  }

  void applyPreset(String presetKey) {
    List<ProviderWorkingHourEntity> updated;
    switch (presetKey) {
      case 'FULL_WEEK_EXTENDED': // 08:00 - 21:00 Cả tuần
        updated = orderedDays.map((day) {
          return ProviderWorkingHourEntity(
            dayOfWeek: day,
            startMinute: 480, // 08:00
            endMinute: 1260, // 21:00
            isWorking: true,
          );
        }).toList();
        break;

      case 'FULL_DAY_MAX': // 07:00 - 22:00 Cả tuần
        updated = orderedDays.map((day) {
          return ProviderWorkingHourEntity(
            dayOfWeek: day,
            startMinute: 420, // 07:00
            endMinute: 1320, // 22:00
            isWorking: true,
          );
        }).toList();
        break;

      case 'OFFICE_HOURS': // T2 - T6: 08:00 - 18:00, T7, CN nghỉ
        updated = orderedDays.map((day) {
          final isWeekday = day >= 1 && day <= 5;
          return ProviderWorkingHourEntity(
            dayOfWeek: day,
            startMinute: 480,
            endMinute: 1080, // 18:00
            isWorking: isWeekday,
          );
        }).toList();
        break;

      case 'STANDARD_WEEK': // T2 - T7: 08:00 - 18:00, CN nghỉ
      default:
        updated = orderedDays.map((day) {
          final isWorkingDay = day != 0;
          return ProviderWorkingHourEntity(
            dayOfWeek: day,
            startMinute: 480,
            endMinute: 1080,
            isWorking: isWorkingDay,
          );
        }).toList();
        break;
    }

    state = state.copyWith(
      draftWorkingHours: updated,
      clearError: true,
      successMessage: 'Đã áp dụng mẫu khung giờ làm việc.',
    );
  }

  void selectDate(DateTime date) {
    state = state.copyWith(selectedCalendarDate: date);
  }

  Future<bool> saveWorkingHours() async {
    final activeHours = state.draftWorkingHours
        .where((h) => h.isWorking && h.endMinute > h.startMinute)
        .toList();

    if (activeHours.isEmpty) {
      state = state.copyWith(
        errorMessage: 'Vui lòng chọn ít nhất 1 ngày làm việc trong tuần!',
      );
      return false;
    }

    state = state.copyWith(isSaving: true, clearError: true, clearSuccess: true);
    try {
      await _repository.updateWorkingHours(activeHours);
      // Reload setup from server
      final updatedSetup = await _repository.getSetup();
      state = state.copyWith(
        setup: AsyncData(updatedSetup),
        draftWorkingHours: _buildDraftFromSetup(updatedSetup.workingHours),
        isSaving: false,
        successMessage: 'Cập nhật lịch làm việc thành công!',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Lưu thất bại: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> createTimeOff({
    required DateTime from,
    required DateTime to,
    required String reason,
  }) async {
    if (to.isBefore(from) || to.difference(from).inMinutes < 15) {
      state = state.copyWith(
        errorMessage: 'Thời gian nghỉ tối thiểu phải từ 15 phút trở lên!',
      );
      return false;
    }

    if (reason.trim().length < 3) {
      state = state.copyWith(
        errorMessage: 'Vui lòng nhập lý do nghỉ ít nhất 3 ký tự!',
      );
      return false;
    }

    state = state.copyWith(isSaving: true, clearError: true, clearSuccess: true);
    try {
      await _repository.createTimeOff(
        from: from,
        to: to,
        reason: reason.trim(),
      );
      await loadCalendar();
      state = state.copyWith(
        isSaving: false,
        successMessage: 'Đã tạo lịch nghỉ thành công!',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Không thể tạo lịch nghỉ: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> deleteTimeOff(String id) async {
    state = state.copyWith(isSaving: true, clearError: true, clearSuccess: true);
    try {
      await _repository.deleteTimeOff(id);
      await loadCalendar();
      state = state.copyWith(
        isSaving: false,
        successMessage: 'Đã mở lại lịch làm việc!',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Không thể mở lại lịch: ${e.toString()}',
      );
      return false;
    }
  }

  void clearMessage() {
    state = state.copyWith(clearError: true, clearSuccess: true);
  }
}
