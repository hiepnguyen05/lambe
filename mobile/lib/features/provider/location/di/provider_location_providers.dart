import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/tracking/presentation/order_tracking_provider.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';

import '../application/provider_location_coordinator.dart';
import '../data/provider_location_device.dart';

final providerLocationCoordinatorProvider =
    ChangeNotifierProvider<ProviderLocationCoordinator>((ref) {
      ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id));
      final dashboard = ref.watch(providerDashboardRemoteDataSourceProvider);
      final tracking = ref.watch(orderTrackingRemoteDataSourceProvider);
      var active = true;
      ref.onDispose(() => active = false);
      final customerLocations = ref.read(userLocationProvider.notifier);
      final coordinator = ProviderLocationCoordinator(
        locate: captureProviderPosition,
        positions: (high) async* {
          await customerLocations.stopPositionStream();
          if (active) yield* watchProviderPositions(high);
        },
        availability: (token) => dashboard.getAvailability(cancelToken: token),
        heartbeat: (point, token) => dashboard.heartbeat((
          latitude: point.latitude,
          longitude: point.longitude,
          accuracyMeters: point.accuracy,
          capturedAt: point.timestamp,
          sequence: point.timestamp.millisecondsSinceEpoch,
        ), cancelToken: token),
        send: (id, point, token) =>
            tracking.sendProviderPosition(id, point, cancelToken: token),
        getOrder: tracking.getProviderOrder,
        backgroundExecution: defaultTargetPlatform == TargetPlatform.android,
      );
      final lifecycle = _ProviderLocationLifecycle(coordinator);
      WidgetsBinding.instance.addObserver(lifecycle);
      ref.onDispose(() => WidgetsBinding.instance.removeObserver(lifecycle));
      if (WidgetsBinding.instance.lifecycleState != null &&
          WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed &&
          WidgetsBinding.instance.lifecycleState !=
              AppLifecycleState.inactive) {
        unawaited(coordinator.setForeground(false));
      }
      return coordinator;
    });

class _ProviderLocationLifecycle extends WidgetsBindingObserver {
  final ProviderLocationCoordinator coordinator;
  _ProviderLocationLifecycle(this.coordinator);
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Native permission dialogs can make a still-visible app inactive.
    if (state == AppLifecycleState.inactive) return;
    unawaited(coordinator.setForeground(state == AppLifecycleState.resumed));
  }
}
