import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/provider_calendar_block_entity.dart';
import '../domain/entities/provider_setup_entity.dart';
import '../domain/entities/provider_working_hour_entity.dart';

class ProviderScheduleState extends Equatable {
  final AsyncValue<ProviderSetupEntity> setup;
  final List<ProviderWorkingHourEntity> draftWorkingHours;
  final AsyncValue<List<ProviderCalendarBlockEntity>> calendarBlocks;
  final DateTime selectedCalendarDate;
  final bool isSaving;
  final String? errorMessage;
  final String? successMessage;

  const ProviderScheduleState({
    this.setup = const AsyncLoading(),
    this.draftWorkingHours = const [],
    this.calendarBlocks = const AsyncLoading(),
    required this.selectedCalendarDate,
    this.isSaving = false,
    this.errorMessage,
    this.successMessage,
  });

  bool get hasUnsavedChanges {
    final original = setup.value?.workingHours ?? [];
    if (original.length != draftWorkingHours.length) return true;
    for (int i = 0; i < draftWorkingHours.length; i++) {
      final d = draftWorkingHours[i];
      final match = original.firstWhere(
        (o) => o.dayOfWeek == d.dayOfWeek,
        orElse: () => const ProviderWorkingHourEntity(dayOfWeek: -1),
      );
      if (match.dayOfWeek == -1) return true;
      if (match.isWorking != d.isWorking ||
          match.startMinute != d.startMinute ||
          match.endMinute != d.endMinute) {
        return true;
      }
    }
    return false;
  }

  int get workingDaysCount =>
      draftWorkingHours.where((h) => h.isWorking).length;

  double get totalWeeklyHours {
    double total = 0;
    for (final h in draftWorkingHours) {
      if (h.isWorking) {
        total += h.workingHoursCount;
      }
    }
    return total;
  }

  List<ProviderCalendarBlockEntity> get blocksForSelectedDate {
    final all = calendarBlocks.value ?? [];
    return all.where((b) {
      final blockDate = DateTime(b.startAt.year, b.startAt.month, b.startAt.day);
      final selDate = DateTime(
        selectedCalendarDate.year,
        selectedCalendarDate.month,
        selectedCalendarDate.day,
      );
      return blockDate.isAtSameMomentAs(selDate);
    }).toList();
  }

  List<ProviderCalendarBlockEntity> get upcomingTimeOffBlocks {
    final all = calendarBlocks.value ?? [];
    final now = DateTime.now();
    return all
        .where((b) => b.isTimeOff && b.endAt.isAfter(now))
        .toList()
      ..sort((a, b) => a.startAt.compareTo(b.startAt));
  }

  ProviderScheduleState copyWith({
    AsyncValue<ProviderSetupEntity>? setup,
    List<ProviderWorkingHourEntity>? draftWorkingHours,
    AsyncValue<List<ProviderCalendarBlockEntity>>? calendarBlocks,
    DateTime? selectedCalendarDate,
    bool? isSaving,
    String? errorMessage,
    String? successMessage,
    bool clearError = false,
    bool clearSuccess = false,
  }) {
    return ProviderScheduleState(
      setup: setup ?? this.setup,
      draftWorkingHours: draftWorkingHours ?? this.draftWorkingHours,
      calendarBlocks: calendarBlocks ?? this.calendarBlocks,
      selectedCalendarDate: selectedCalendarDate ?? this.selectedCalendarDate,
      isSaving: isSaving ?? this.isSaving,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage:
          clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }

  @override
  List<Object?> get props => [
        setup,
        draftWorkingHours,
        calendarBlocks,
        selectedCalendarDate,
        isSaving,
        errorMessage,
        successMessage,
      ];
}
