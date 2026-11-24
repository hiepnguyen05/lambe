import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/data/datasources/customer_orders_remote_datasource.dart';
import 'package:mobile/features/customer/orders/data/repositories/customer_orders_repository_impl.dart';

void main() {
  late _MockDio mockDio;
  late CustomerOrdersRemoteDataSource remoteDataSource;
  late CustomerOrdersRepositoryImpl repository;

  setUp(() {
    mockDio = _MockDio();
    remoteDataSource = DioCustomerOrdersRemoteDataSource(mockDio);
    repository = CustomerOrdersRepositoryImpl(remoteDataSource);
  });

  group('CustomerOrdersRepository Tests', () {
    test('getMyOrders returns parsed CustomerOrderEntity list', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/orders'),
        statusCode: 200,
        data: {
          'success': true,
          'data': [
            {
              'id': 'ord-101',
              'bookingType': 'ASAP',
              'status': 'PENDING_PROVIDER',
              'serviceName': 'Gội đầu dưỡng sinh',
              'servicePriceAmount': 180000,
              'travelFeeAmount': 0,
              'totalAmount': 180000,
              'providerResponseDeadlineAt': '2026-10-19T11:05:00.000Z',
              'provider': {'id': 'prv-1', 'displayName': 'Linh Beauty'},
            },
          ],
        },
      );

      final orders = await repository.getMyOrders();
      expect(orders.length, 1);
      final first = orders.first;
      expect(first.id, 'ord-101');
      expect(first.status, 'PENDING_PROVIDER');
      expect(first.isPending, isTrue);
      expect(first.isActive, isFalse);
      expect(first.shouldPoll, isTrue);
      expect(first.canCancel, isTrue);
      expect(first.serviceName, 'Gội đầu dưỡng sinh');
      expect(first.provider?.displayName, 'Linh Beauty');
    });

    test('cancelOrder posts reason and returns updated order entity', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/orders/ord-101/cancel'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'id': 'ord-101',
            'bookingType': 'ASAP',
            'status': 'CANCELLED',
            'serviceName': 'Gội đầu dưỡng sinh',
            'servicePriceAmount': 180000,
            'totalAmount': 180000,
          },
        },
      );

      final cancelledOrder = await repository.cancelOrder(
        'ord-101',
        reason: 'Tôi bận việc đột xuất',
      );

      expect(cancelledOrder.id, 'ord-101');
      expect(cancelledOrder.status, 'CANCELLED');
      expect(cancelledOrder.isCancelled, isTrue);
      expect(mockDio.lastData['reason'], 'Tôi bận việc đột xuất');
    });

    test(
      'rejected order keeps the provider reason and stops active tracking',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/me/orders/ord-101'),
          statusCode: 200,
          data: {
            'success': true,
            'data': {
              'id': 'ord-101',
              'status': 'REJECTED',
              'bookingType': 'ASAP',
              'serviceName': 'Cắt tóc',
              'servicePriceAmount': 150000,
              'totalAmount': 150000,
              'rejectionReason': 'Không kịp đến đúng giờ',
            },
          },
        );

        final order = await repository.getMyOrderById('ord-101');
        expect(order.isRejected, isTrue);
        expect(order.isActive, isFalse);
        expect(order.shouldPoll, isFalse);
        expect(order.rejectionReason, 'Không kịp đến đúng giờ');
      },
    );

    test('decideCancellation sends approve boolean and note', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(
          path: '/me/orders/ord-101/cancellation/decision',
        ),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'id': 'ord-101',
            'bookingType': 'ASAP',
            'status': 'CANCELLED',
            'serviceName': 'Cắt tóc',
            'servicePriceAmount': 150000,
            'totalAmount': 150000,
            'cancellationRequest': {
              'id': 'cancel-1',
              'status': 'APPROVED',
              'reason': 'TRANSPORT_ISSUE',
            },
          },
        },
      );

      final updated = await repository.decideCancellation(
        'ord-101',
        approve: true,
        note: 'Đồng ý hủy do thợ kẹt xe',
      );

      expect(mockDio.lastData['approve'], isTrue);
      expect(mockDio.lastData['note'], 'Đồng ý hủy do thợ kẹt xe');
      expect(updated.isCancelled, isTrue);
      expect(updated.cancellationRequest?.status, 'APPROVED');
    });

    test(
      'customer order includes a pending cancellation and request time',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/me/orders/ord-101'),
          statusCode: 200,
          data: {
            'success': true,
            'data': {
              'id': 'ord-101',
              'bookingType': 'ASAP',
              'status': 'EN_ROUTE',
              'serviceName': 'Cắt tóc',
              'servicePriceAmount': 150000,
              'totalAmount': 150000,
              'cancellationRequest': {
                'id': 'cancel-1',
                'status': 'PENDING_CUSTOMER',
                'reason': 'TRANSPORT_ISSUE',
                'requestedAt': '2026-10-20T07:00:00.000Z',
              },
            },
          },
        );

        final order = await repository.getMyOrderById('ord-101');
        expect(order.cancellationRequest?.status, 'PENDING_CUSTOMER');
        expect(order.cancellationRequest?.createdAt, isNotNull);
      },
    );

    test('submitReview sends rating 1-5 and comment', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/orders/ord-101/review'),
        statusCode: 201,
        data: {
          'success': true,
          'data': {'id': 'rev-1', 'rating': 5},
        },
      );

      await repository.submitReview(
        'ord-101',
        rating: 5,
        comment: 'Dịch vụ rất tốt và đúng giờ',
      );

      expect(mockDio.lastData['rating'], 5);
      expect(mockDio.lastData['comment'], 'Dịch vụ rất tốt và đúng giờ');
    });

    test('CustomerOrderEntity correctly parses tracking properties and provider rating', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/orders/ord-202'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'id': 'ord-202',
            'bookingType': 'ASAP',
            'status': 'EN_ROUTE',
            'serviceName': 'Massage cổ vai gáy',
            'servicePriceAmount': 250000,
            'travelFeeAmount': 20000,
            'travelDistanceKm': 3.5,
            'totalAmount': 270000,
            'addressLine': '123 Nguyễn Huệ, Quận 1',
            'addressLatitude': 10.7769,
            'addressLongitude': 106.7009,
            'provider': {
              'id': 'prv-99',
              'displayName': 'Thợ Chuyên Nghiệp',
              'phone': '0901234567',
              'rating': 4.9,
            },
          },
        },
      );

      final order = await repository.getMyOrderById('ord-202');
      expect(order.id, 'ord-202');
      expect(order.isEnRoute, isTrue);
      expect(order.isActive, isTrue);
      expect(order.addressLatitude, 10.7769);
      expect(order.addressLongitude, 106.7009);
      expect(order.provider?.displayName, 'Thợ Chuyên Nghiệp');
      expect(order.provider?.rating, 4.9);
      expect(order.provider?.phone, '0901234567');
    });
  });
}

class _MockDio extends DioMixin implements Dio {
  dynamic lastData;
  Options? lastOptions;
  Response<dynamic>? responseToReturn;
  DioException? errorToThrow;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastData = data;
    lastOptions = options;
    if (errorToThrow != null) throw errorToThrow!;
    return responseToReturn as Response<T>;
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastData = data;
    lastOptions = options;
    if (errorToThrow != null) throw errorToThrow!;
    return responseToReturn as Response<T>;
  }
}
