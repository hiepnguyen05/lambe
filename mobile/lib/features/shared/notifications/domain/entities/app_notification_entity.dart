enum NotificationCategory {
  all,
  order,
  promotion,
  system;

  String get label => switch (this) {
    NotificationCategory.all => 'Tất cả',
    NotificationCategory.order => 'Đơn hàng',
    NotificationCategory.promotion => 'Khuyến mãi',
    NotificationCategory.system => 'Hệ thống',
  };
}

class AppNotificationEntity {
  final String id;
  final String title;
  final String body;
  final NotificationCategory category;
  final DateTime createdAt;
  final bool isRead;
  final String? destination;
  final String? actionLabel;
  final Map<String, dynamic>? metadata;

  const AppNotificationEntity({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.createdAt,
    this.isRead = false,
    this.destination,
    this.actionLabel,
    this.metadata,
  });

  AppNotificationEntity copyWith({
    String? id,
    String? title,
    String? body,
    NotificationCategory? category,
    DateTime? createdAt,
    bool? isRead,
    String? destination,
    String? actionLabel,
    Map<String, dynamic>? metadata,
  }) {
    return AppNotificationEntity(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      category: category ?? this.category,
      createdAt: createdAt ?? this.createdAt,
      isRead: isRead ?? this.isRead,
      destination: destination ?? this.destination,
      actionLabel: actionLabel ?? this.actionLabel,
      metadata: metadata ?? this.metadata,
    );
  }
}
