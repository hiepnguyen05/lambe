import 'dart:convert';

import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../domain/order_notification.dart';

class OrderNotificationsRemoteDataSource {
  final Dio _dio;

  const OrderNotificationsRemoteDataSource(this._dio);

  Future<List<OrderNotification>> list() async {
    final response = await _dio.get(ApiEndpoints.meNotifications);
    return ApiResponseParser.dataList(response)
        .whereType<Map<String, dynamic>>()
        .map(OrderNotification.fromJson)
        .toList();
  }

  Future<void> markRead(String id) async {
    final response = await _dio.patch(ApiEndpoints.markNotificationRead(id));
    ApiResponseParser.ensureSuccess(response);
  }

  Stream<OrderNotification> watch({CancelToken? cancelToken}) async* {
    String? after;
    while (!(cancelToken?.isCancelled ?? false)) {
      try {
        final response = await _dio.get<ResponseBody>(
          ApiEndpoints.notificationEvents,
          queryParameters: after == null ? null : {'after': after},
          cancelToken: cancelToken,
          options: Options(
            responseType: ResponseType.stream,
            receiveTimeout: Duration.zero,
            headers: {'Accept': 'text/event-stream'},
          ),
        );
        final body = response.data;
        if (body != null) {
          await for (final line
              in utf8.decoder.bind(body.stream).transform(const LineSplitter())) {
            if (cancelToken?.isCancelled ?? false) break;
            if (!line.startsWith('data: ')) continue;
            try {
              final value = jsonDecode(line.substring(6));
              if (value is! Map<String, dynamic>) continue;
              after = value['id']?.toString();
              yield OrderNotification.fromJson(value);
            } catch (_) {
              // Bỏ qua dòng SSE lỗi định dạng để giữ kết nối
            }
          }
        }
      } on DioException catch (error) {
        if (cancelToken?.isCancelled ?? false) break;
        if (error.response?.statusCode == 401) rethrow;
      } catch (_) {
        if (cancelToken?.isCancelled ?? false) break;
        // Tự phục hồi khi kết nối bị ngắt hoặc lỗi định dạng
      }
      if (cancelToken?.isCancelled ?? false) break;
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  }
}
