import '../../domain/repositories/provider_dashboard_repository.dart';
import '../datasources/provider_dashboard_remote_datasource.dart';

class ProviderDashboardRepositoryImpl implements ProviderDashboardRepository {
  final ProviderDashboardRemoteDataSource _remoteDataSource;

  ProviderDashboardRepositoryImpl(this._remoteDataSource);

  @override
  Future<bool> getAvailability() {
    return _remoteDataSource.getAvailability();
  }

  @override
  Future<void> goOnline(double latitude, double longitude) {
    return _remoteDataSource.goOnline(latitude, longitude);
  }

  @override
  Future<void> goOffline() {
    return _remoteDataSource.goOffline();
  }

  @override
  Future<int> getSetupRadius() {
    return _remoteDataSource.getSetupRadius();
  }

  @override
  Future<void> updateSetupRadius(int radiusKm) {
    return _remoteDataSource.updateSetupRadius(radiusKm);
  }
}
