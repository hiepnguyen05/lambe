import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_notifications/data/order_notifications_remote_datasource.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';

void main() {
  test('cancellation request opens the customer order for a decision', () {
    final notification = OrderNotification.fromJson({
      'id': 'notice-1',
      'orderId': 'order-1',
      'event': 'CANCELLATION_REQUESTED',
      'recipientRole': 'CUSTOMER',
      'readAt': null,
      'createdAt': '2026-10-20T07:00:00.000Z',
    });

    expect(notification.isUnread, isTrue);
    expect(notification.destination, '/appointments/order-1');
    expect(notification.title, contains('hủy'));
  });

  test('provider decision notification opens the provider order', () {
    final notification = OrderNotification.fromJson({
      'id': 'notice-2',
      'orderId': 'order-2',
      'event': 'CANCELLATION_APPROVED',
      'recipientRole': 'PROVIDER',
      'readAt': '2026-10-20T07:01:00.000Z',
      'createdAt': '2026-10-20T07:00:00.000Z',
    });

    expect(notification.isUnread, isFalse);
    expect(notification.destination, '/provider/orders/order-2');
    expect(notification.title, 'Yêu cầu hủy đã được chấp thuận');
  });

  test('support denial does not claim the request is still under review', () {
    final notification = OrderNotification.fromJson({
      'id': 'notice-3',
      'orderId': 'order-2',
      'event': 'CANCELLATION_DENIED',
      'recipientRole': 'PROVIDER',
      'createdAt': '2026-10-20T07:00:00.000Z',
    });

    expect(notification.title, 'Hỗ trợ không chấp nhận yêu cầu hủy');
  });

  test('loads persisted notifications and marks one as read', () async {
    final dio = _NotificationDio();
    final source = OrderNotificationsRemoteDataSource(dio);
    final notifications = await source.list();

    expect(notifications.single.event, 'CANCELLATION_REQUESTED');
    await source.markRead('notice-1');
    expect(dio.lastPatchPath, '/me/notifications/notice-1/read');
  });
}

class _NotificationDio extends DioMixin implements Dio {
  String? lastPatchPath;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    return Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': [
          {
            'id': 'notice-1',
            'orderId': 'order-1',
            'event': 'CANCELLATION_REQUESTED',
            'recipientRole': 'CUSTOMER',
            'readAt': null,
            'createdAt': '2026-10-20T07:00:00.000Z',
          },
        ],
      },
    ) as Response<T>;
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPatchPath = path;
    return Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': null},
    ) as Response<T>;
  }
}
