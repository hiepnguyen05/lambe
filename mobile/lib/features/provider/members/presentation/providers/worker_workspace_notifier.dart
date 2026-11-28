import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import '../../domain/entities/provider_membership_entity.dart';
import '../../domain/entities/worker_availability_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../../di/provider_members_providers.dart';

typedef WorkerPositionLookup = Future<({double latitude, double longitude})?> Function();

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
  final WorkerPositionLookup _getCurrentPosition;
  Timer? _heartbeatTimer;
  double? _lastLat;
  double? _lastLng;

  WorkerWorkspaceNotifier(
    this._repository, {
    bool autoLoad = true,
    WorkerPositionLookup? getCurrentPosition,
  }) : _getCurrentPosition = getCurrentPosition ?? _defaultCurrentPosition,
       super(WorkerWorkspaceState(isLoading: autoLoad)) {
    if (autoLoad) {
      loadWorkspace();
    }
  }

  static Future<({double latitude, double longitude})?> _defaultCurrentPosition() async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return null;
      final permission = await Geolocator.checkPermission();
      if (permission != LocationPermission.always &&
          permission != LocationPermission.whileInUse) {
        return null;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 6),
        ),
      );
      return (latitude: position.latitude, longitude: position.longitude);
    } catch (_) {
      try {
        final fallback = await Geolocator.getLastKnownPosition();
        if (fallback == null) return null;
        return (latitude: fallback.latitude, longitude: fallback.longitude);
      } catch (error) {
        debugPrint('[WorkerWorkspace] Unable to resolve worker GPS: $error');
        return null;
      }
    }
  }

  Future<bool> _ensureCoordinates() async {
    if (_lastLat != null && _lastLng != null) return true;
    final pos = await _getCurrentPosition();
    if (pos == null) return false;
    _lastLat = pos.latitude;
    _lastLng = pos.longitude;
    return true;
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
      if (!mounted) return;
      final active = memberships.where((m) => m.isActive).firstOrNull;

      if (active == null) {
        state = state.copyWith(isLoading: false);
        return;
      }

      final results = await Future.wait([
        _repository.getWorkerAvailability(active.id),
        _repository.getWorkerReceivingSettings(active.id),
      ]);
      if (!mounted) return;

      final avail = results[0] as WorkerAvailabilityEntity;
      final settings = results[1] as WorkerReceivingSettingsEntity;

      state = state.copyWith(
        activeMembership: active,
        availability: avail,
        settings: settings,
        isLoading: false,
      );

      if (avail.online) {
        await _ensureCoordinates();
        if (!mounted) return;
        _startHeartbeat(active.id, avail.heartbeatTtlSeconds);
      }
    } catch (e) {
      if (!mounted) return;
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
          if (!await _ensureCoordinates()) return;
          final lat = _lastLat;
          final lng = _lastLng;
          if (lat == null || lng == null) return;
          final res = await _repository.sendWorkerHeartbeat(
            membershipId,
            lat,
            lng,
          );
          if (!mounted) return;
          state = state.copyWith(availability: res);
        } catch (error) {
          debugPrint('[WorkerWorkspace] Heartbeat failed: $error');
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
        if (!mounted) return false;
        state = state.copyWith(availability: res, isTogglingOnline: false);
        return true;
      } else {
        final res = await _repository.setWorkerOnline(
          membership.id,
          latitude,
          longitude,
        );
        if (!mounted) return false;
        state = state.copyWith(availability: res, isTogglingOnline: false);
        if (res.online) {
          _startHeartbeat(membership.id, res.heartbeatTtlSeconds);
        }
        return true;
      }
    } catch (e) {
      if (!mounted) return false;
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
      if (!mounted) return false;
      state = state.copyWith(settings: updated);
      return true;
    } catch (e) {
      if (!mounted) return false;
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
    final userId = ref.watch(
      authNotifierProvider.select((s) => s.valueOrNull?.id),
    );
    final repository = ref.watch(providerMembersRepositoryProvider);
    return WorkerWorkspaceNotifier(repository, autoLoad: userId != null);
  },
);

