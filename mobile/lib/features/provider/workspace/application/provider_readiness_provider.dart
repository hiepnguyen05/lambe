import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../data/datasources/provider_readiness_datasource.dart';

final providerReadinessProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
      final id = ref.watch(
        authNotifierProvider.select((a) => a.valueOrNull?.id),
      );
      if (id == null) return {};
      final cancel = CancelToken();
      ref.onDispose(() => cancel.cancel());
      return loadProviderReadiness(ref.watch(dioProvider), cancel);
    });

final gpsReadinessProvider = FutureProvider.autoDispose<bool>((ref) async {
  final lifecycle = AppLifecycleListener(onResume: ref.invalidateSelf);
  ref.onDispose(lifecycle.dispose);
  final permission = await Geolocator.checkPermission();
  return await Geolocator.isLocationServiceEnabled() &&
      [
        LocationPermission.always,
        LocationPermission.whileInUse,
      ].contains(permission);
});
