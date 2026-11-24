import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile/features/shared/tracking/data/order_tracking_remote_datasource.dart';

class _TrackingAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    expect(options.uri.path, '/api/me/orders/order-1/tracking/events');
    final event =
        'data: ${jsonEncode({
          'status': 'LIVE',
          'position': {'latitude': 21.02, 'longitude': 105.85, 'accuracyMeters': 10, 'capturedAt': DateTime.now().toUtc().toIso8601String()},
          'route': null,
        })}\n\n';
    final chunks = [event.substring(0, 7), event.substring(7)];
    return ResponseBody(
      Stream.fromIterable(chunks.map(utf8.encode)),
      200,
      headers: {
        Headers.contentTypeHeader: ['text/event-stream'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _PositionAdapter implements HttpClientAdapter {
  final bool accepted;

  _PositionAdapter({this.accepted = true});

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    expect(options.method, 'PUT');
    expect(options.uri.path, '/api/me/provider/orders/order-1/location');
    expect(options.data, containsPair('latitude', 21.02));
    return ResponseBody.fromString(
      jsonEncode({
        'data': {
          'accepted': accepted,
          if (accepted)
            'tracking': {
              'status': 'LIVE',
              'position': {
                'latitude': 21.02,
                'longitude': 105.85,
                'capturedAt': DateTime.now().toUtc().toIso8601String(),
              },
              'route': {
                'coordinates': [
                  [105.85, 21.02],
                  [105.86, 21.03],
                ],
                'distanceMeters': 1400,
                'durationSeconds': 600,
              },
            },
        },
      }),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('reads a real provider position from split SSE chunks', () async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:5000/api'));
    dio.httpClientAdapter = _TrackingAdapter();
    final token = CancelToken();
    final source = OrderTrackingRemoteDataSource(dio);

    final snapshot = await source.watch('order-1', token).first;
    token.cancel();

    expect(snapshot.status, 'LIVE');
    expect(snapshot.position!.latitude, 21.02);
    expect(snapshot.position!.longitude, 105.85);
  });

  test(
    'provider position upload receives the same route as the customer',
    () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:5000/api'));
      dio.httpClientAdapter = _PositionAdapter();
      final source = OrderTrackingRemoteDataSource(dio);
      final position = Position(
        latitude: 21.02,
        longitude: 105.85,
        timestamp: DateTime.now(),
        accuracy: 10,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );

      final snapshot = await source.sendProviderPosition('order-1', position);

      expect(snapshot!.status, 'LIVE');
      expect(snapshot.distanceMeters, 1400);
      expect(snapshot.durationSeconds, 600);
      expect(snapshot.routePoints.first.latitude, 21.02);
      expect(snapshot.routePoints.last.longitude, 105.86);
    },
  );

  test('rejected position upload does not return a stale route', () async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:5000/api'));
    dio.httpClientAdapter = _PositionAdapter(accepted: false);
    final source = OrderTrackingRemoteDataSource(dio);
    final position = Position(
      latitude: 21.02,
      longitude: 105.85,
      timestamp: DateTime.now(),
      accuracy: 10,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

    expect(await source.sendProviderPosition('order-1', position), isNull);
  });
}
