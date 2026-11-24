import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';

import '../domain/entities/provider_dashboard_entity.dart';
import '../di/provider_workspace_providers.dart';

class ProviderDashboardNotifier extends AsyncNotifier<ProviderDashboardEntity> {
  int _generation = 0;
  bool _disposed = false, _changing = false;
  CancelToken _cancel = CancelToken();
  bool _current(int generation) => !_disposed && generation == _generation;
  @override
  Future<ProviderDashboardEntity> build() async {
    final generation = ++_generation;
    _disposed = false;
    _changing = false;
    _cancel = CancelToken();
    final cancel = _cancel;
    ref.onDispose(() {
      _disposed = true;
      cancel.cancel();
    });
    final repository = ref.watch(providerDashboardRepositoryProvider);
    final locations = ref.watch(providerLocationCoordinatorProvider.notifier);
    ref.listen(
      providerLocationCoordinatorProvider.select(
        (v) => (v.online, v.availabilityKnown),
      ),
      (_, next) {
        final previous = state.valueOrNull;
        if (_current(generation) && previous != null && !_changing) {
          state = AsyncData(
            previous.copyWith(isOnline: next.$1, availabilityVerified: next.$2),
          );
        }
      },
    );
    final values = await Future.wait<Object>([
      repository.getAvailability(cancelToken: cancel),
      repository.getSetupRadius(cancelToken: cancel),
    ]);
    if (!_current(generation)) throw StateError('Phiên đối tác đã thay đổi.');
    await locations.confirmedOnline(values[0] as bool);
    return ProviderDashboardEntity(
      isOnline: values[0] as bool,
      availabilityVerified: true,
      serviceRadius: values[1] as int,
    );
  }

  Future<String?> toggleOnlineStatus(bool online) async {
    final previous = state.valueOrNull;
    if (previous == null || _changing || _disposed) return null;
    final generation = _generation, token = _cancel;
    final locations = ref.read(providerLocationCoordinatorProvider);
    final repository = ref.read(providerDashboardRepositoryProvider);
    _changing = true;
    state = AsyncData(previous.copyWith(isUpdating: true));
    try {
      if (online) {
        final position = await locations.capture(requestPermission: true);
        if (!_current(generation)) return null;
        await repository.goOnline((
          latitude: position.latitude,
          longitude: position.longitude,
          accuracyMeters: position.accuracy,
          capturedAt: position.timestamp,
          sequence: position.timestamp.millisecondsSinceEpoch,
        ), cancelToken: token);
        if (!_current(generation)) return null;
        await locations.confirmedOnline(true, seed: position);
      } else {
        await repository.goOffline(cancelToken: token);
        if (!_current(generation)) return null;
        await locations.confirmedOnline(false);
      }
      if (_current(generation)) {
        state = AsyncData(
          (state.valueOrNull ?? previous).copyWith(
            isOnline: online,
            availabilityVerified: true,
            isUpdating: false,
          ),
        );
      }
      return null;
    } catch (error) {
      if (!_current(generation)) return null;
      // A failed write is not proof of either online/offline. Read the server again.
      await locations.reconcileAvailability();
      if (_current(generation)) {
        state = AsyncData(
          (state.valueOrNull ?? previous).copyWith(
            isOnline: locations.online,
            availabilityVerified: locations.availabilityKnown,
            isUpdating: false,
          ),
        );
      }
      return _message(error);
    } finally {
      if (_current(generation)) _changing = false;
    }
  }

  Future<void> refreshAvailability() async {
    if (_disposed || _changing) return;
    await ref.read(providerLocationCoordinatorProvider).reconcileAvailability();
  }

  Future<String?> setRadius(int radius) async {
    final previous = state.valueOrNull;
    if (previous == null || _disposed) return null;
    final generation = _generation;
    state = AsyncData(previous.copyWith(serviceRadius: radius));
    try {
      await ref
          .read(providerDashboardRepositoryProvider)
          .updateSetupRadius(radius, cancelToken: _cancel);
      return null;
    } catch (error) {
      if (_current(generation)) {
        state = AsyncData(
          (state.valueOrNull ?? previous).copyWith(
            serviceRadius: previous.serviceRadius,
          ),
        );
      }
      return _message(error);
    }
  }

  String _message(Object error) {
    if (error is StateError) return error.message.toString();
    if (error is DioException && error.response?.data is Map) {
      final data = error.response!.data as Map;
      final message = data['message'];
      if (message is String) return message;
      if (message is List) return message.join('\n');
    }
    return 'Chưa xác nhận được thao tác. Kiểm tra kết nối và tải lại trạng thái.';
  }
}
