import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/data/datasources/provider_orders_remote_datasource.dart';

class MockDioAdapter implements HttpClientAdapter {
  late Response Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final response = handler(options);
    return ResponseBody.fromString(
      response.data is String ? response.data : '',
      response.statusCode ?? 200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late Dio dio;
  late DioProviderOrdersRemoteDataSource dataSource;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:5000/api'));
    dataSource = DioProviderOrdersRemoteDataSource(dio);
  });

  group('ProviderOrdersRemoteDataSource Tests', () {
    test('getProviderOrders returns list of orders', () async {
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': [
                    {
                      'id': 'ord-1',
                      'status': 'ACCEPTED',
                      'serviceName': 'Cắt tóc',
                    },
                  ],
                },
              ),
            );
          },
        ),
      );

      final list = await dataSource.getAllProviderOrders();
      expect(list.length, 1);
      expect(list.first['id'], 'ord-1');
      expect(list.first['status'], 'ACCEPTED');
    });

    test('getProviderOrderDetail returns order map', () async {
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': {
                    'id': 'ord-1',
                    'status': 'EN_ROUTE',
                    'serviceName': 'Gội đầu dưỡng sinh',
                    'totalAmount': 200000,
                  },
                },
              ),
            );
          },
        ),
      );

      final detail = await dataSource.getProviderOrderDetail('ord-1');
      expect(detail['id'], 'ord-1');
      expect(detail['status'], 'EN_ROUTE');
      expect(detail['totalAmount'], 200000);
    });

    test('action methods post correctly to their endpoints', () async {
      String? lastEndpoint;
      dynamic lastBody;

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            lastEndpoint = options.path;
            lastBody = options.data;
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': {'id': 'ord-1'},
                },
              ),
            );
          },
        ),
      );

      await dataSource.markEnRoute('ord-1');
      expect(lastEndpoint, '/me/provider/orders/ord-1/en-route');

      final capturedAt = DateTime.utc(2026, 10, 23);
      await dataSource.markArrived(
        'ord-1',
        latitude: 21.028,
        longitude: 105.834,
        accuracyMeters: 15,
        capturedAt: capturedAt,
      );
      expect(lastEndpoint, '/me/provider/orders/ord-1/arrive');
      expect(lastBody, {
        'latitude': 21.028,
        'longitude': 105.834,
        'accuracyMeters': 15,
        'capturedAt': capturedAt.toIso8601String(),
      });

      await dataSource.startOrder('ord-1');
      expect(lastEndpoint, '/me/provider/orders/ord-1/start');

      await dataSource.completeOrder('ord-1', cashReceived: true);
      expect(lastEndpoint, '/me/provider/orders/ord-1/complete');
      expect(lastBody, {'cashReceived': true});

      await dataSource.recordContactAttempt('ord-1');
      expect(lastEndpoint, '/me/provider/orders/ord-1/contact-attempt');

      await dataSource.requestCancellation(
        'ord-1',
        reason: 'TRANSPORT_ISSUE',
        detail: 'Xe bị thủng lốp',
      );
      expect(lastEndpoint, '/me/provider/orders/ord-1/cancellation-request');
      expect(lastBody, {
        'reason': 'TRANSPORT_ISSUE',
        'detail': 'Xe bị thủng lốp',
      });
    });

    test('getEvidenceSignedUrl reads the private evidence endpoint', () async {
      String? lastEndpoint;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            lastEndpoint = options.path;
            return handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': {'url': 'https://media.example/evidence.jpg'},
                },
              ),
            );
          },
        ),
      );

      final url = await dataSource.getEvidenceSignedUrl('ord-1', 'evidence-1');

      expect(lastEndpoint, '/orders/ord-1/evidence/evidence-1');
      expect(url, 'https://media.example/evidence.jpg');
    });
  });
}
