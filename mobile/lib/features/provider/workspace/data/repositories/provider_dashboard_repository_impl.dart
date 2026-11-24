import 'package:dio/dio.dart';

import '../../domain/repositories/provider_dashboard_repository.dart';
import '../datasources/provider_dashboard_remote_datasource.dart';

class ProviderDashboardRepositoryImpl implements ProviderDashboardRepository {
  final ProviderDashboardRemoteDataSource _remoteDataSource;

  ProviderDashboardRepositoryImpl(this._remoteDataSource);

  @override
  Future<bool> getAvailability({CancelToken? cancelToken}) {
    return _remoteDataSource.getAvailability(cancelToken: cancelToken);
  }

  @override
  Future<void> goOnline(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  }) {
    return _remoteDataSource.goOnline(location, cancelToken: cancelToken);
  }

  @override
  Future<void> heartbeat(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  }) {
    return _remoteDataSource.heartbeat(location, cancelToken: cancelToken);
  }

  @override
  Future<void> goOffline({CancelToken? cancelToken}) {
    return _remoteDataSource.goOffline(cancelToken: cancelToken);
  }

  @override
  Future<int> getSetupRadius({CancelToken? cancelToken}) {
    return _remoteDataSource.getSetupRadius(cancelToken: cancelToken);
  }

  @override
  Future<void> updateSetupRadius(int radiusKm, {CancelToken? cancelToken}) {
    return _remoteDataSource.updateSetupRadius(
      radiusKm,
      cancelToken: cancelToken,
    );
  }
}
