import 'package:dio/dio.dart';

typedef ProviderLocationSample = ({
  double latitude,
  double longitude,
  double accuracyMeters,
  DateTime capturedAt,
  int sequence,
});

abstract class ProviderDashboardRepository {
  Future<bool> getAvailability({CancelToken? cancelToken});
  Future<void> goOnline(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  });
  Future<void> heartbeat(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  });
  Future<void> goOffline({CancelToken? cancelToken});
  Future<int> getSetupRadius({CancelToken? cancelToken});
  Future<void> updateSetupRadius(int radiusKm, {CancelToken? cancelToken});
}
