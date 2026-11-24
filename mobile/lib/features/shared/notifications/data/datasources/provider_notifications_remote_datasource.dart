import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/app_notification_entity.dart';

class ProviderNotificationsRemoteDataSource {
  final Dio dio;
  ProviderNotificationsRemoteDataSource(this.dio);
  static const path = '/me/provider/notifications';

  Future<List<AppNotificationEntity>> list() async {
    try {
      final response = await dio.get(path, queryParameters: {'limit': 20});
      return ApiResponseParser.dataList(response)
          .map((row) => _present(Map<String, dynamic>.from(row as Map)))
          .toList();
    } on DioException catch (error) {
      // A PROVIDER role may belong to a worker rather than a profile owner.
      if (error.response?.statusCode == 403) return [];
      rethrow;
    }
  }

  Future<void> markRead(String id) async {
    ApiResponseParser.ensureSuccess(await dio.patch('$path/$id/read'));
  }

  Future<String> destination(String id) async {
    final json = ApiResponseParser.dataMap(await dio.get('$path/$id'));
    if (json['event'] == 'WALLET_LOW_BALANCE') return '/provider/income';
    final member = json['memberId'];
    return member is String && RegExp(r'^[0-9a-fA-F-]{36}$').hasMatch(member)
        ? '/provider/members/$member'
        : '/provider/account';
  }

  AppNotificationEntity _present(Map<String, dynamic> json) {
    final event = json['event'] as String;
    final body = switch (event) {
      'WALLET_LOW_BALANCE' => 'Kiểm tra số dư khả dụng để tiếp tục nhận đơn.',
      _ => 'Có thay đổi trong hoạt động đối tác. Mở để kiểm tra trạng thái mới nhất.',
    };
    return AppNotificationEntity(
      id: json['id'] as String,
      title: event == 'WALLET_LOW_BALANCE'
          ? 'Số dư ví nhận đơn thấp'
          : 'Cập nhật hoạt động đối tác',
      body: body,
      category: NotificationCategory.system,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isRead: json['readAt'] != null,
      actionLabel: 'Xem chi tiết',
      metadata: {
        'event': event,
        'entityType': 'PROVIDER_NOTIFICATION',
        'entityId': json['id'],
        'recipientRole': 'PROVIDER_OWNER',
        'resolvedAt': json['resolvedAt'],
      },
    );
  }
}
