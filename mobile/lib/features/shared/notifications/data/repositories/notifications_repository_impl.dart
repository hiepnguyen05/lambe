import 'package:dio/dio.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/features/shared/order_notifications/data/order_notifications_remote_datasource.dart';

import '../../domain/entities/app_notification_entity.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../datasources/provider_notifications_remote_datasource.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  final OrderNotificationsRemoteDataSource orderDataSource;
  final ProviderNotificationsRemoteDataSource? providerDataSource;
  final Dio dio;

  NotificationsRepositoryImpl({
    required this.orderDataSource,
    required this.dio,
    this.providerDataSource,
  });

  @override
  Future<List<AppNotificationEntity>> getNotifications({
    required String userId,
  }) async {
    try {
      final pages = await Future.wait([
        orderDataSource.list().then(
          (rows) => rows
              .map(
                (n) => AppNotificationEntity(
                  id: n.id,
                  title: n.title,
                  body: 'Mở đơn để xem trạng thái và thao tác mới nhất.',
                  category: NotificationCategory.order,
                  createdAt: n.createdAt,
                  isRead: !n.isUnread,
                  destination: n.destination,
                  actionLabel: 'Xem đơn',
                  metadata: {
                    'orderId': n.orderId,
                    'event': n.event,
                    'entityType': 'ORDER',
                    'entityId': n.orderId,
                    'recipientRole': n.recipientRole,
                  },
                ),
              )
              .toList(),
        ),
        if (providerDataSource != null) providerDataSource!.list(),
      ]);
      final unique = <String, AppNotificationEntity>{};
      for (final item in pages.expand((page) => page)) {
        unique[item.id] = item;
      }
      return unique.values.toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> markAsRead(
    String notificationId, {
    String? userId,
    String entityType = 'ORDER',
  }) async {
    try {
      if (entityType == 'PROVIDER_NOTIFICATION') {
        if (providerDataSource == null) throw const UnauthorizedFailure();
        await providerDataSource!.markRead(notificationId);
      } else {
        await orderDataSource.markRead(notificationId);
      }
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> markAllAsRead({required String userId}) async {
    final loaded = await getNotifications(userId: userId);
    for (final notice in loaded.where((n) => !n.isRead)) {
      await markAsRead(
        notice.id,
        userId: userId,
        entityType: notice.metadata?['entityType'] as String? ?? 'ORDER',
      );
    }
  }

  @override
  Future<void> deleteNotification(String notificationId) async {
    throw const ValidationFailure('Máy chủ chưa hỗ trợ xóa thông báo.');
  }

  @override
  Future<String?> resolveDestination(AppNotificationEntity notice) async {
    try {
      if (notice.metadata?['entityType'] == 'PROVIDER_NOTIFICATION') {
        if (providerDataSource == null) throw const UnauthorizedFailure();
        return await providerDataSource!.destination(notice.id);
      }
      final orderId = notice.metadata?['orderId'];
      final role = notice.metadata?['recipientRole'];
      if (orderId is! String ||
          !RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(orderId) ||
          (role != 'CUSTOMER' && role != 'PROVIDER')) {
        return null;
      }
      final path = role == 'PROVIDER'
          ? '/me/provider/orders/$orderId'
          : '/me/orders/$orderId';
      ApiResponseParser.dataMap(await dio.get(path));
      return role == 'PROVIDER'
          ? '/provider/orders/$orderId'
          : '/appointments/$orderId';
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}
