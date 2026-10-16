abstract class ProviderDashboardRepository {
  Future<bool> getAvailability();
  Future<void> goOnline(double latitude, double longitude);
  Future<void> goOffline();
  Future<int> getSetupRadius();
  Future<void> updateSetupRadius(int radiusKm);
}
