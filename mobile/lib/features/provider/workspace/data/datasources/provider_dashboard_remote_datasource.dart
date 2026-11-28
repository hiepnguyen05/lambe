import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/repositories/provider_dashboard_repository.dart';

abstract class ProviderDashboardRemoteDataSource {
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

class DioProviderDashboardRemoteDataSource
    implements ProviderDashboardRemoteDataSource {
  final Dio _dio;

  DioProviderDashboardRemoteDataSource(this._dio);

  @override
  Future<bool> getAvailability({CancelToken? cancelToken}) async {
    try {
      final response = await _dio.get(
        '/me/provider/availability',
        cancelToken: cancelToken,
      );
      final data = ApiResponseParser.dataMap(response);
      if (data['online'] is! bool) {
        throw const FormatException('Thiếu trạng thái hoạt động từ server.');
      }
      return data['online'] == true;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return false;
      }
      rethrow;
    }
  }

  @override
  Future<void> goOnline(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.post(
      '/me/provider/availability/online',
      cancelToken: cancelToken,
      data: _locationPayload(location),
    );
    ApiResponseParser.dataMap(response);
  }

  @override
  Future<void> heartbeat(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.put(
      '/me/provider/availability/heartbeat',
      cancelToken: cancelToken,
      data: _locationPayload(location),
    );
    ApiResponseParser.dataMap(response);
  }

  Map<String, Object> _locationPayload(ProviderLocationSample location) => {
    'latitude': location.latitude,
    'longitude': location.longitude,
    'accuracyMeters': location.accuracyMeters,
    'capturedAt': location.capturedAt.toUtc().toIso8601String(),
    'sequence': location.sequence,
  };

  @override
  Future<void> goOffline({CancelToken? cancelToken}) async {
    final response = await _dio.post(
      '/me/provider/availability/offline',
      cancelToken: cancelToken,
    );
    ApiResponseParser.dataMap(response);
  }

  @override
  Future<int> getSetupRadius({CancelToken? cancelToken}) async {
    try {
      final response = await _dio.get(
        '/me/provider/setup',
        cancelToken: cancelToken,
      );
      final data = ApiResponseParser.dataMap(response);
      return (data['serviceRadiusKm'] as num?)?.toInt() ?? 5;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return 5;
      }
      rethrow;
    }
  }

  @override
  Future<void> updateSetupRadius(
    int radiusKm, {
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.patch(
      '/me/provider/setup/radius',
      data: {'serviceRadiusKm': radiusKm},
      cancelToken: cancelToken,
    );
    ApiResponseParser.dataMap(response);
  }
}
