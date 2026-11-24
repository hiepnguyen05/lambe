class OrderNotification {
  final String id;
  final String orderId;
  final String event;
  final String recipientRole;
  final DateTime createdAt;
  final DateTime? readAt;

  const OrderNotification({
    required this.id,
    required this.orderId,
    required this.event,
    required this.recipientRole,
    required this.createdAt,
    this.readAt,
  });

  bool get isUnread => readAt == null;

  String get title => switch (event) {
    'ORDER_REQUESTED' => 'Có đơn đặt lịch mới',
    'ORDER_ACCEPTED' => 'Chuyên viên đã nhận lịch',
    'ORDER_REJECTED' => 'Chuyên viên đã từ chối lịch',
    'ORDER_CANCELLED' => 'Đơn đặt lịch đã bị hủy',
    'ORDER_COMPLETED' => 'Đơn đặt lịch đã hoàn tất',
    'PAYMENT_DISPUTE_OPENED' => 'Đơn đang chờ xác minh thanh toán',
    'PAYMENT_DISPUTE_CONFIRM_UNPAID' =>
      'Đã xác minh chưa thanh toán · Chờ xử lý',
    'PAYMENT_DISPUTE_CONFIRM_PAID' => 'Đã xác minh thanh toán · Đơn hoàn tất',
    'ORDER_EXPIRED' => 'Yêu cầu đặt lịch đã hết hạn',
    'CANCELLATION_REQUESTED' => 'Chuyên viên yêu cầu hủy đơn',
    'CANCELLATION_APPROVED' => 'Yêu cầu hủy đã được chấp thuận',
    'CANCELLATION_ESCALATED' => 'Yêu cầu hủy đã chuyển hỗ trợ',
    'CANCELLATION_DENIED' => 'Hỗ trợ không chấp nhận yêu cầu hủy',
    'ORDER_RESCHEDULE_REQUESTED' => 'Khách đề xuất đổi giờ hẹn',
    'ORDER_RESCHEDULE_ACCEPTED' => 'Chuyên viên đã chấp nhận giờ mới',
    'ORDER_RESCHEDULE_REJECTED' => 'Chuyên viên đã từ chối đổi giờ',
    'ORDER_ADD_ON_REQUESTED' => 'Có đề nghị thêm dịch vụ',
    'ORDER_ADD_ON_ACCEPTED' => 'Khách đã đồng ý dịch vụ phát sinh',
    'ORDER_ADD_ON_REJECTED' => 'Khách đã từ chối dịch vụ phát sinh',
    'ORDER_ADD_ON_CANCELLED' => 'Đề nghị thêm dịch vụ đã được rút lại',
    'ORDER_ADD_ON_EXPIRED' => 'Đề nghị thêm dịch vụ đã hết hạn',
    _ => 'Đơn đặt lịch có cập nhật',
  };

  String get destination {
    return recipientRole == 'PROVIDER'
        ? '/provider/orders/$orderId'
        : '/appointments/$orderId';
  }

  factory OrderNotification.fromJson(Map<String, dynamic> json) {
    return OrderNotification(
      id: json['id']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      event: json['event']?.toString() ?? '',
      recipientRole: json['recipientRole']?.toString() ?? 'CUSTOMER',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      readAt: DateTime.tryParse(json['readAt']?.toString() ?? ''),
    );
  }
}
