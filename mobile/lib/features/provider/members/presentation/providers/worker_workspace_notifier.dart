import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/provider_membership_entity.dart';
import '../../domain/entities/worker_availability_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

class WorkerWorkspaceState {
  final ProviderMembershipEntity? activeMembership;
  final WorkerAvailabilityEntity? availability;
  final WorkerReceivingSettingsEntity? settings;
  final bool isLoading;
  final bool isTogglingOnline;
  final String? errorMessage;

  const WorkerWorkspaceState({
    this.activeMembership,
    this.availability,
    this.settings,
    this.isLoading = false,
    this.isTogglingOnline = false,
    this.errorMessage,
  });

  bool get isOnline => availability?.online == true;
  bool get isWorkerInOrganization =>
      activeMembership != null && activeMembership!.isWorker;

  WorkerWorkspaceState copyWith({
    ProviderMembershipEntity? activeMembership,
    WorkerAvailabilityEntity? availability,
    WorkerReceivingSettingsEntity? settings,
    bool? isLoading,
    bool? isTogglingOnline,
    String? errorMessage,
  }) {
    return WorkerWorkspaceState(
      activeMembership: activeMembership ?? this.activeMembership,
      availability: availability ?? this.availability,
      settings: settings ?? this.settings,
      isLoading: isLoading ?? this.isLoading,
      isTogglingOnline: isTogglingOnline ?? this.isTogglingOnline,
      errorMessage: errorMessage,
    );
  }
}

class WorkerWorkspaceNotifier extends StateNotifier<WorkerWorkspaceState> {
  final ProviderMembersRepository _repository;
  Timer? _heartbeatTimer;
  double _lastLat = 10.7769; // Default HCM
  double _lastLng = 106.7009;

  WorkerWorkspaceNotifier(this._repository)
      : super(const WorkerWorkspaceState(isLoading: true)) {
    loadWorkspace();
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  Future<void> loadWorkspace() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final memberships = await _repository.getMyMemberships();
      final active = memberships.where((m) => m.isActive).firstOrNull;

      if (active == null) {
        state = state.copyWith(isLoading: false);
        return;
      }

      final results = await Future.wait([
        _repository.getWorkerAvailability(active.id),
        _repository.getWorkerReceivingSettings(active.id),
      ]);

      final avail = results[0] as WorkerAvailabilityEntity;
      final settings = results[1] as WorkerReceivingSettingsEntity;

      state = state.copyWith(
        activeMembership: active,
        availability: avail,
        settings: settings,
        isLoading: false,
      );

      if (avail.online) {
        _startHeartbeat(active.id, avail.heartbeatTtlSeconds);
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Lỗi tải không gian làm việc: ${e.toString()}',
      );
    }
  }

  void _startHeartbeat(String membershipId, int ttlSeconds) {
    _heartbeatTimer?.cancel();
    // Gửi heartbeat định kỳ trước khi hết hạn TTL (khoảng 60% TTL)
    final intervalSeconds = (ttlSeconds * 0.6).clamp(30, 90).toInt();
    _heartbeatTimer = Timer.periodic(
      Duration(seconds: intervalSeconds),
      (_) async {
        try {
          final res = await _repository.sendWorkerHeartbeat(
            membershipId,
            _lastLat,
            _lastLng,
          );
          state = state.copyWith(availability: res);
        } catch (_) {
          // Heartbeat background failure handled gracefully
        }
      },
    );
  }

  Future<bool> toggleOnline({
    required double latitude,
    required double longitude,
    String? offlineReason,
  }) async {
    final membership = state.activeMembership;
    if (membership == null) return false;

    _lastLat = latitude;
    _lastLng = longitude;
    state = state.copyWith(isTogglingOnline: true, errorMessage: null);

    try {
      if (state.isOnline) {
        final res = await _repository.setWorkerOffline(
          membership.id,
          reason: offlineReason ?? 'Chủ động tắt trực tuyến',
        );
        _heartbeatTimer?.cancel();
        state = state.copyWith(availability: res, isTogglingOnline: false);
        return true;
      } else {
        final res = await _repository.setWorkerOnline(
          membership.id,
          latitude,
          longitude,
        );
        state = state.copyWith(availability: res, isTogglingOnline: false);
        if (res.online) {
          _startHeartbeat(membership.id, res.heartbeatTtlSeconds);
        }
        return true;
      }
    } catch (e) {
      state = state.copyWith(
        isTogglingOnline: false,
        errorMessage: 'Không thể thay đổi trạng thái trực tuyến: ${e.toString()}',
      );
      return false;
    }
  }

  Future<bool> updateRadius(int radiusKm) async {
    final membership = state.activeMembership;
    if (membership == null) return false;
    try {
      final updated = await _repository.updateWorkerReceivingSettings(
        membership.id,
        radiusKm,
      );
      state = state.copyWith(settings: updated);
      return true;
    } catch (e) {
      state = state.copyWith(
        errorMessage: 'Lỗi lưu bán kính: ${e.toString()}',
      );
      return false;
    }
  }
}

final workerWorkspaceProvider =
    StateNotifierProvider<WorkerWorkspaceNotifier, WorkerWorkspaceState>(
  (ref) {
    final repository = ref.watch(providerMembersRepositoryProvider);
    return WorkerWorkspaceNotifier(repository);
  },
);

