import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

Future<void> logoutWithProviderCleanup(WidgetRef ref) async {
  final user = ref.read(authNotifierProvider).valueOrNull;
  final auth = ref.read(authNotifierProvider.notifier);
  if (user?.roles.contains('PROVIDER') == true) {
    final locations = ref.read(providerLocationCoordinatorProvider);
    final dashboard = ref.read(providerDashboardRepositoryProvider);
    await locations.stopAll();
    try {
      await dashboard.goOffline().timeout(const Duration(seconds: 5));
    } catch (_) {
      // The backend stops accepting stale locations after its heartbeat TTL.
    }
  }
  await auth.logout();
}
