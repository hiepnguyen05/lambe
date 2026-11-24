import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/member_service_offering_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

class MemberServicesAssignmentState {
  final List<MemberServiceOfferingEntity> options;
  final Set<String> selectedServiceIds;
  final bool isLoading;
  final bool isSaving;
  final String? errorMessage;
  final bool saveSuccess;

  const MemberServicesAssignmentState({
    this.options = const [],
    this.selectedServiceIds = const {},
    this.isLoading = false,
    this.isSaving = false,
    this.errorMessage,
    this.saveSuccess = false,
  });

  MemberServicesAssignmentState copyWith({
    List<MemberServiceOfferingEntity>? options,
    Set<String>? selectedServiceIds,
    bool? isLoading,
    bool? isSaving,
    String? errorMessage,
    bool? saveSuccess,
  }) {
    return MemberServicesAssignmentState(
      options: options ?? this.options,
      selectedServiceIds: selectedServiceIds ?? this.selectedServiceIds,
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      errorMessage: errorMessage,
      saveSuccess: saveSuccess ?? this.saveSuccess,
    );
  }
}

class MemberServicesAssignmentNotifier
    extends StateNotifier<MemberServicesAssignmentState> {
  final ProviderMembersRepository _repository;
  final String memberId;

  MemberServicesAssignmentNotifier(this._repository, this.memberId)
      : super(const MemberServicesAssignmentState(isLoading: true)) {
    loadServices();
  }

  Future<void> loadServices() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final results = await Future.wait([
        _repository.getMemberServiceOptions(memberId),
        _repository.getMemberServices(memberId),
      ]);
      final options = results[0];
      final assigned = results[1];

      final assignedIds = assigned.map((e) => e.providerServiceId).toSet();
      state = state.copyWith(
        options: options,
        selectedServiceIds: assignedIds,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Không thể tải danh sách dịch vụ: ${e.toString()}',
      );
    }
  }

  void toggleService(String providerServiceId) {
    final next = Set<String>.from(state.selectedServiceIds);
    if (next.contains(providerServiceId)) {
      next.remove(providerServiceId);
    } else {
      next.add(providerServiceId);
    }
    state = state.copyWith(selectedServiceIds: next);
  }

  Future<bool> saveAssignment(String reason) async {
    if (reason.trim().isEmpty) {
      state = state.copyWith(errorMessage: 'Vui lòng nhập lý do phân công.');
      return false;
    }
    state = state.copyWith(isSaving: true, errorMessage: null);
    try {
      final updated = await _repository.assignMemberServices(
        memberId,
        state.selectedServiceIds.toList(),
        reason.trim(),
      );
      final assignedIds = updated.map((e) => e.providerServiceId).toSet();
      state = state.copyWith(
        selectedServiceIds: assignedIds,
        isSaving: false,
        saveSuccess: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSaving: false,
        errorMessage: 'Lỗi khi lưu phân công: ${e.toString()}',
      );
      return false;
    }
  }
}

final memberServicesAssignmentProvider = StateNotifierProvider.autoDispose
    .family<MemberServicesAssignmentNotifier, MemberServicesAssignmentState,
        String>((ref, memberId) {
  final repository = ref.watch(providerMembersRepositoryProvider);
  return MemberServicesAssignmentNotifier(repository, memberId);
});
