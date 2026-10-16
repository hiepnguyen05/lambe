import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../domain/entities/provider_dashboard_entity.dart';
import '../domain/repositories/provider_dashboard_repository.dart';
import '../di/provider_workspace_providers.dart';

class ProviderDashboardNotifier extends AsyncNotifier<ProviderDashboardEntity> {
  late final ProviderDashboardRepository _repository;

  @override
  Future<ProviderDashboardEntity> build() async {
    _repository = ref.watch(providerDashboardRepositoryProvider);
    
    // Fetch initial data
    try {
      final isOnline = await _repository.getAvailability();
      final radius = await _repository.getSetupRadius();
      
      return ProviderDashboardEntity(
        isOnline: isOnline,
        serviceRadius: radius,
        todayEarnings: 0,
        completedBookings: 0,
        upcomingAppointments: [],
      );
    } catch (e) {
      // Fallback
      return const ProviderDashboardEntity(
        isOnline: false,
        serviceRadius: 5,
        todayEarnings: 0,
        completedBookings: 0,
        upcomingAppointments: [],
      );
    }
  }

  Future<String?> toggleOnlineStatus(bool isOnline) async {
    final previousState = state.value;
    if (previousState == null) return null;

    // Optimistic update
    state = AsyncData(previousState.copyWith(isOnline: isOnline));

    try {
      if (isOnline) {
        double lat = 21.0285;
        double lng = 105.8542;
        try {
          final permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.always ||
              permission == LocationPermission.whileInUse) {
            final pos = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(
                accuracy: LocationAccuracy.medium,
                timeLimit: Duration(seconds: 3),
              ),
            );
            lat = pos.latitude;
            lng = pos.longitude;
          }
        } catch (_) {
          // Dùng toạ độ mặc định
        }

        await _repository.goOnline(lat, lng);
      } else {
        await _repository.goOffline();
      }
      return null;
    } catch (e) {
      // Revert on failure
      state = AsyncData(previousState);
      return _extractErrorMessage(e);
    }
  }

  Future<String?> setRadius(int radius) async {
    final previousState = state.value;
    if (previousState == null) return null;

    // Optimistic update
    state = AsyncData(previousState.copyWith(serviceRadius: radius));

    try {
      await _repository.updateSetupRadius(radius);
      return null;
    } catch (e) {
      // Revert on failure
      state = AsyncData(previousState);
      return _extractErrorMessage(e);
    }
  }

  String _extractErrorMessage(dynamic error) {
    if (error is DioException) {
      final responseData = error.response?.data;
      if (responseData is Map) {
        final message = responseData['message'];
        if (message is String) return message;
        if (message is List && message.isNotEmpty) {
          return message.map((e) => e.toString()).join('\n');
        }
      }
      if (error.response?.statusCode == 404) {
        return 'Không tìm thấy hồ sơ hoặc cấu hình đối tác.';
      }
    }
    return 'Thao tác không thành công: $error';
  }
}
