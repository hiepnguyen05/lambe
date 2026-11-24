import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/data/datasources/provider_dashboard_remote_datasource.dart';

void main() {
  test('heartbeat sends current coordinates to the availability API', () async {
    final dio = _AvailabilityDio();
    final source = DioProviderDashboardRemoteDataSource(dio);
    final capturedAt = DateTime.utc(2026, 11, 5, 5, 30);

    await source.heartbeat((
      latitude: 21.0655,
      longitude: 106.2298,
      accuracyMeters: 8.5,
      capturedAt: capturedAt,
      sequence: capturedAt.millisecondsSinceEpoch,
    ));

    expect(dio.lastPath, '/me/provider/availability/heartbeat');
    expect(dio.lastData, {
      'latitude': 21.0655,
      'longitude': 106.2298,
      'accuracyMeters': 8.5,
      'capturedAt': '2026-11-05T05:30:00.000Z',
      'sequence': capturedAt.millisecondsSinceEpoch,
    });
  });
}

class _AvailabilityDio extends DioMixin implements Dio {
  String? lastPath;
  Object? lastData;

  @override
  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPath = path;
    lastData = data;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': {'online': true},
      } as T,
    );
  }
}
