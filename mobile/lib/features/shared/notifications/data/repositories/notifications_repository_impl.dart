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
                  body: _orderNotificationBody(n.event),
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

  static String _orderNotificationBody(String event) => switch (event) {
    'ORDER_ADD_ON_REQUESTED' =>
      'Chuyên viên đề nghị bổ sung dịch vụ mới. Mở đơn hàng để xem giá và xác nhận.',
    'ORDER_ADD_ON_ACCEPTED' =>
      'Khách hàng đã đồng ý dịch vụ phát sinh. Đơn hàng đã cập nhật tổng tiền.',
    'ORDER_ADD_ON_REJECTED' => 'Khách hàng chưa đồng ý dịch vụ phát sinh.',
    'ORDER_ADD_ON_CANCELLED' => 'Đề nghị dịch vụ phát sinh đã được rút lại.',
    'ORDER_ADD_ON_EXPIRED' => 'Đề nghị dịch vụ phát sinh đã hết thời gian xác nhận.',
    'ORDER_EN_ROUTE' => 'Chuyên viên đang trên đường đến điểm hẹn của bạn.',
    'ORDER_ARRIVED' => 'Chuyên viên đã đến địa chỉ đặt lịch.',
    'ORDER_IN_PROGRESS' => 'Chuyên viên đã bắt đầu thực hiện dịch vụ.',
    'ORDER_WORK_PAUSED' => 'Chuyên viên tạm dừng đồng hồ thực hiện dịch vụ.',
    'ORDER_WORK_RESUMED' => 'Chuyên viên đã tiếp tục thực hiện dịch vụ.',
    'CANCELLATION_REQUESTED' =>
      'Vui lòng mở đơn hàng để kiểm tra và phản hồi yêu cầu hủy.',
    'ORDER_RESCHEDULE_REQUESTED' =>
      'Vui lòng mở đơn hàng để xác nhận khung giờ hẹn mới.',
    'ORDER_RESCHEDULE_ACCEPTED' =>
      'Đề xuất đổi giờ hẹn đã được xác nhận. Mở đơn để xem lịch mới.',
    'ORDER_RESCHEDULE_REJECTED' =>
      'Đề xuất đổi giờ hẹn chưa được đồng ý. Lịch hẹn cũ vẫn được giữ nguyên.',
    'ORDER_RESCHEDULE_EXPIRED' =>
      'Đề xuất đổi giờ hẹn đã hết hạn phản hồi. Lịch hẹn cũ vẫn được giữ.',
    'ORDER_RESCHEDULE_CANCELLED' =>
      'Đề xuất đổi giờ không còn hiệu lực do đơn đã chuyển trạng thái.',
    _ => 'Mở đơn để xem trạng thái và thao tác mới nhất.',
  };
}
