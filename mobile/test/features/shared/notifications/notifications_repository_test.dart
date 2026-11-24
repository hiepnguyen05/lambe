import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/features/shared/notifications/data/datasources/provider_notifications_remote_datasource.dart';
import 'package:mobile/features/shared/notifications/data/repositories/notifications_repository_impl.dart';
import 'package:mobile/features/shared/notifications/domain/entities/app_notification_entity.dart';
import 'package:mobile/features/shared/order_notifications/data/order_notifications_remote_datasource.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';

const orderId = '12345678-1234-4234-8234-123456789012';
const ownerId = '22345678-1234-4234-8234-123456789012';
void main() {
  test(
    'only backend notifications exist without invented promotions',
    () async {
      final repo = NotificationsRepositoryImpl(
        orderDataSource: _Orders(),
        dio: _Dio(),
      );
      final list = await repo.getNotifications(userId: 'u');
      expect(list.length, 1);
      expect(list.single.category, NotificationCategory.order);
      expect(list.single.metadata!['entityType'], 'ORDER');
      expect(list.where((n) => n.id.startsWith('promo-')), isEmpty);
    },
  );

  test(
    'offline fails visibly rather than returning static promotions',
    () async {
      final orders = _Orders()..fail = true;
      final repo = NotificationsRepositoryImpl(
        orderDataSource: orders,
        dio: _Dio(),
      );
      await expectLater(
        repo.getNotifications(userId: 'u'),
        throwsA(isA<NetworkFailure>()),
      );
    },
  );

  test('empty backend yields an empty notification center', () async {
    final orders = _Orders()..empty = true;
    final repo = NotificationsRepositoryImpl(
      orderDataSource: orders,
      dio: _Dio(),
    );
    expect(await repo.getNotifications(userId: 'u'), isEmpty);
  });

  test(
    'owner notices merge with orders and read via correct endpoint',
    () async {
      final dio = _Dio();
      final repo = NotificationsRepositoryImpl(
        orderDataSource: _Orders(),
        dio: dio,
        providerDataSource: ProviderNotificationsRemoteDataSource(dio),
      );
      final list = await repo.getNotifications(userId: 'u');
      expect(list.length, 2);
      expect(list.first.id, ownerId);
      await repo.markAsRead(ownerId, entityType: 'PROVIDER_NOTIFICATION');
      expect(dio.patches.single, '/me/provider/notifications/$ownerId/read');
    },
  );

  test(
    'worker 403 excludes owner notices but does not mask server errors',
    () async {
      final dio = _Dio()..ownerStatus = 403;
      final repo = NotificationsRepositoryImpl(
        orderDataSource: _Orders(),
        dio: dio,
        providerDataSource: ProviderNotificationsRemoteDataSource(dio),
      );
      expect((await repo.getNotifications(userId: 'u')).length, 1);
      dio.ownerStatus = 503;
      await expectLater(
        repo.getNotifications(userId: 'u'),
        throwsA(isA<ServerFailure>()),
      );
    },
  );

  test('mark read failure is propagated', () async {
    final orders = _Orders()..readFail = true;
    final repo = NotificationsRepositoryImpl(
      orderDataSource: orders,
      dio: _Dio(),
    );
    await expectLater(
      repo.markAsRead('notice-order'),
      throwsA(isA<NetworkFailure>()),
    );
    expect(orders.read, isEmpty);
  });

  test('order is refetched before opening a server-authorized route', () async {
    final dio = _Dio();
    final repo = NotificationsRepositoryImpl(
      orderDataSource: _Orders(),
      dio: dio,
    );
    final item = (await repo.getNotifications(userId: 'u')).single;
    expect(await repo.resolveDestination(item), '/appointments/$orderId');
    expect(dio.gets.last, '/me/orders/$orderId');
  });

  test(
    'owner destination is derived from verified detail, not deepLink',
    () async {
      final dio = _Dio();
      final repo = NotificationsRepositoryImpl(
        orderDataSource: _Orders(),
        dio: dio,
        providerDataSource: ProviderNotificationsRemoteDataSource(dio),
      );
      final list = await repo.getNotifications(userId: 'u');
      expect(await repo.resolveDestination(list.first), '/provider/income');
      expect(dio.gets.last, '/me/provider/notifications/$ownerId');
    },
  );

  test(
    'unsupported delete does not pretend the backend deleted anything',
    () async {
      final repo = NotificationsRepositoryImpl(
        orderDataSource: _Orders(),
        dio: _Dio(),
      );
      await expectLater(
        repo.deleteNotification('n'),
        throwsA(isA<ValidationFailure>()),
      );
    },
  );
}

class _Orders implements OrderNotificationsRemoteDataSource {
  bool fail = false, readFail = false, empty = false;
  final read = <String>[];
  @override
  Future<List<OrderNotification>> list() async {
    if (fail) {
      throw DioException(
        requestOptions: RequestOptions(path: '/me/notifications'),
        type: DioExceptionType.connectionError,
      );
    }
    return empty
        ? []
        : [
            OrderNotification.fromJson({
              'id': 'notice-order',
              'orderId': orderId,
              'event': 'ORDER_ACCEPTED',
              'recipientRole': 'CUSTOMER',
              'createdAt': '2026-10-30T08:00:00.000Z',
            }),
          ];
  }

  @override
  Future<void> markRead(String id) async {
    if (readFail) {
      throw DioException(
        requestOptions: RequestOptions(path: id),
        type: DioExceptionType.connectionError,
      );
    }
    read.add(id);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Dio extends DioMixin implements Dio {
  final gets = <String>[], patches = <String>[];
  int ownerStatus = 200;
  Map<String, Object?> get notice => {
    'id': ownerId,
    'event': 'WALLET_LOW_BALANCE',
    'createdAt': '2026-10-31T08:00:00.000Z',
    'readAt': null,
    'deepLink': 'https://untrusted.example',
  };
  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    gets.add(path);
    if (path == '/me/provider/notifications' && ownerStatus != 200) {
      throw DioException(
        requestOptions: RequestOptions(path: path),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: ownerStatus,
        ),
      );
    }
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': path == '/me/provider/notifications' ? [notice] : notice,
      } as T,
    );
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
    patches.add(path);
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': notice} as T,
    );
  }
}
