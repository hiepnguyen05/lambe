import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/organization_receiving_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

class OrganizationReceivingState {
  final OrganizationReceivingEntity? receiving;
  final bool isLoading;
  final bool isToggling;
  final String? errorMessage;

  const OrganizationReceivingState({
    this.receiving,
    this.isLoading = false,
    this.isToggling = false,
    this.errorMessage,
  });

  bool get isEnabled => receiving?.enabled == true;

  OrganizationReceivingState copyWith({
    OrganizationReceivingEntity? receiving,
    bool? isLoading,
    bool? isToggling,
    String? errorMessage,
  }) {
    return OrganizationReceivingState(
      receiving: receiving ?? this.receiving,
      isLoading: isLoading ?? this.isLoading,
      isToggling: isToggling ?? this.isToggling,
      errorMessage: errorMessage,
    );
  }
}

class OrganizationReceivingNotifier
    extends StateNotifier<OrganizationReceivingState> {
  final ProviderMembersRepository _repository;

  OrganizationReceivingNotifier(this._repository)
      : super(const OrganizationReceivingState(isLoading: true)) {
    loadStatus();
  }

  Future<void> loadStatus() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _repository.getOrganizationReceivingStatus();
      state = state.copyWith(receiving: res, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Không thể tải trạng thái nhận đơn: ${e.toString()}',
      );
    }
  }

  Future<bool> toggleReceiving({required bool enabled, required String reason}) async {
    if (reason.trim().isEmpty) {
      state = state.copyWith(errorMessage: 'Vui lòng nhập lý do thay đổi.');
      return false;
    }
    state = state.copyWith(isToggling: true, errorMessage: null);
    try {
      final res = await _repository.updateOrganizationReceivingStatus(
        enabled,
        reason.trim(),
      );
      state = state.copyWith(receiving: res, isToggling: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isToggling: false,
        errorMessage: 'Lỗi cập nhật nhận đơn cơ sở: ${e.toString()}',
      );
      return false;
    }
  }
}

final organizationReceivingProvider = StateNotifierProvider.autoDispose<
    OrganizationReceivingNotifier, OrganizationReceivingState>(
  (ref) {
    final repository = ref.watch(providerMembersRepositoryProvider);
    return OrganizationReceivingNotifier(repository);
  },
);

