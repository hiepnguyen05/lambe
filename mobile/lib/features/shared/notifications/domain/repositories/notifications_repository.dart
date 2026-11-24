import '../entities/app_notification_entity.dart';

abstract class NotificationsRepository {
  Future<List<AppNotificationEntity>> getNotifications({
    required String userId,
  });
  Future<void> markAsRead(
    String notificationId, {
    String? userId,
    String entityType = 'ORDER',
  });
  Future<void> markAllAsRead({required String userId});
  Future<void> deleteNotification(String notificationId);
  Future<String?> resolveDestination(AppNotificationEntity notification);
}
