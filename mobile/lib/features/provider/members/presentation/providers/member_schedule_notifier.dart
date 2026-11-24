import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

class MemberTimeOffItem {
  final String id;
  final DateTime startAt;
  final DateTime endAt;
  final String? reason;

  const MemberTimeOffItem({
    required this.id,
    required this.startAt,
    required this.endAt,
    this.reason,
  });

  factory MemberTimeOffItem.fromJson(Map<String, dynamic> json) {
    return MemberTimeOffItem(
      id: json['id']?.toString() ?? '',
      startAt: DateTime.tryParse(json['startAt']?.toString() ?? '') ?? DateTime.now(),
      endAt: DateTime.tryParse(json['endAt']?.toString() ?? '') ?? DateTime.now(),
      reason: json['reason']?.toString(),
    );
  }
}

class MemberWorkingShiftItem {
  final int dayOfWeek; // 0=CN, 1=T2...6=T7
  final int startMinute;
  final int endMinute;

  const MemberWorkingShiftItem({
    required this.dayOfWeek,
    required this.startMinute,
    required this.endMinute,
  });

  factory MemberWorkingShiftItem.fromJson(Map<String, dynamic> json) {
    return MemberWorkingShiftItem(
      dayOfWeek: (json['dayOfWeek'] as num?)?.toInt() ?? 1,
      startMinute: (json['startMinute'] as num?)?.toInt() ?? 480,
      endMinute: (json['endMinute'] as num?)?.toInt() ?? 1200,
    );
  }

  Map<String, dynamic> toJson() => {
        'dayOfWeek': dayOfWeek,
        'startMinute': startMinute,
        'endMinute': endMinute,
      };

  String get dayName {
    switch (dayOfWeek) {
      case 1:
        return 'Thứ Hai';
      case 2:
        return 'Thứ Ba';
      case 3:
        return 'Thứ Tư';
      case 4:
        return 'Thứ Năm';
      case 5:
        return 'Thứ Sáu';
      case 6:
        return 'Thứ Bảy';
      case 0:
      default:
        return 'Chủ Nhật';
    }
  }

  String get timeRangeString {
    final startH = (startMinute ~/ 60).toString().padLeft(2, '0');
    final startM = (startMinute % 60).toString().padLeft(2, '0');
    final endH = (endMinute ~/ 60).toString().padLeft(2, '0');
    final endM = (endMinute % 60).toString().padLeft(2, '0');
    return '$startH:$startM - $endH:$endM';
  }
}

class MemberScheduleState {
  final List<MemberWorkingShiftItem> shifts;
  final List<MemberTimeOffItem> timeOffs;
  final bool isLoading;
  final bool isSaving;
  final String? errorMessage;

  const MemberScheduleState({
    this.shifts = const [],
    this.timeOffs = const [],
    this.isLoading = false,
    this.isSaving = false,
    this.errorMessage,
  });

  MemberScheduleState copyWith({
    List<MemberWorkingShiftItem>? shifts,
    List<MemberTimeOffItem>? timeOffs,
    bool? isLoading,
    bool? isSaving,
    String? errorMessage,
  }) {
    return MemberScheduleState(
      shifts: shifts ?? this.shifts,
      timeOffs: timeOffs ?? this.timeOffs,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      errorMessage: errorMessage,
    );
  }
}

class MemberScheduleNotifier extends StateNotifier<MemberScheduleState> {
  final ProviderMembersRepository _repository;
  final String memberId;

  MemberScheduleNotifier(this._repository, this.memberId)
      : super(const MemberScheduleState(isLoading: true)) {
    loadSchedule();
  }

  Future<void> loadSchedule() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final results = await Future.wait([
        _repository.getMemberWorkingHours(memberId),
        _repository.getMemberTimeOffs(memberId),
      ]);

      final shiftsRaw = results[0];
      final timeOffsRaw = results[1];

      final shifts = shiftsRaw
          .map((m) => MemberWorkingShiftItem.fromJson(m))
          .toList()
        ..sort((a, b) => a.dayOfWeek.compareTo(b.dayOfWeek));
      final timeOffs = timeOffsRaw
          .map((m) => MemberTimeOffItem.fromJson(m))
          .toList()
        ..sort((a, b) => a.startAt.compareTo(b.startAt));

      state = state.copyWith(
        shifts: shifts,
        timeOffs: timeOffs,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Lỗi tải lịch: ${e.toString()}',
      );
    }
  }

  Future<bool> updateShifts(
    List<MemberWorkingShiftItem> updatedShifts,
    String reason,
  ) async {
    state = state.copyWith(isSaving: true, errorMessage: null);
    try {
      final data = updatedShifts.map((s) => s.toJson()).toList();
      final res = await _repository.updateMemberWorkingHours(
        memberId,
        data,
        reason.trim(),
      );
      final shifts = res
          .map((m) => MemberWorkingShiftItem.fromJson(m))
          .toList()
        ..sort((a, b) => a.dayOfWeek.compareTo(b.dayOfWeek));
      state = state.copyWith(shifts: shifts, isSaving: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Lỗi cập nhật ca: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> addTimeOff(
    DateTime startAt,
    DateTime endAt,
    String reason,
  ) async {
    if (reason.trim().isEmpty) {
      state = state.copyWith(errorMessage: 'Vui lòng nhập lý do nghỉ phép.');
      return false;
    }
    state = state.copyWith(isSaving: true, errorMessage: null);
    try {
      await _repository.addMemberTimeOff(
        memberId,
        startAt,
        endAt,
        reason.trim(),
      );
      await loadSchedule();
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Lỗi đăng ký nghỉ: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> deleteTimeOff(String timeOffId, String reason) async {
    state = state.copyWith(isSaving: true, errorMessage: null);
    try {
      await _repository.deleteMemberTimeOff(
        memberId,
        timeOffId,
        reason.trim(),
      );
      await loadSchedule();
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Lỗi hủy lịch nghỉ: ${e.toString()}',
      );
      return false;
    }
  }
}

final memberScheduleProvider = StateNotifierProvider.autoDispose
    .family<MemberScheduleNotifier, MemberScheduleState, String>((ref, memberId) {
  final repository = ref.watch(providerMembersRepositoryProvider);
  return MemberScheduleNotifier(repository, memberId);
});
