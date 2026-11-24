import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/customer_order_entity.dart';

abstract class CustomerOrdersRemoteDataSource {
  Future<List<CustomerOrderEntity>> getMyOrders({String? status});
  Future<CustomerOrderEntity> getMyOrderById(String orderId);
  Future<CustomerOrderEntity> cancelOrder(
    String orderId, {
    required String reason,
  });
  Future<CustomerOrderEntity> decideCancellation(
    String orderId, {
    required bool approve,
    String? note,
  });
  Future<void> submitReview(
    String orderId, {
    required int rating,
    String? comment,
  });
  Future<String?> getEvidenceSignedUrl(String orderId, String evidenceId);
}

class DioCustomerOrdersRemoteDataSource
    implements CustomerOrdersRemoteDataSource {
  final Dio _dio;

  DioCustomerOrdersRemoteDataSource(this._dio);

  String _extractErrorMessage(DioException e, {required String fallback}) {
    final resData = e.response?.data;
    if (resData is Map<String, dynamic>) {
      final msg = resData['message'];
      if (msg is String && msg.isNotEmpty) {
        return msg;
      } else if (msg is List && msg.isNotEmpty) {
        return msg.first.toString();
      }
    }
    return e.message ?? fallback;
  }

  @override
  Future<List<CustomerOrderEntity>> getMyOrders({String? status}) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.meOrders,
        queryParameters: status != null ? {'status': status} : null,
      );

      final list = ApiResponseParser.dataList(response);
      return list
          .whereType<Map<String, dynamic>>()
          .map((json) => CustomerOrderEntity.fromJson(json))
          .toList();
    } on DioException catch (e) {
      throw Exception(
        _extractErrorMessage(e, fallback: 'Không thể tải danh sách đơn hàng.'),
      );
    }
  }

  @override
  Future<CustomerOrderEntity> getMyOrderById(String orderId) async {
    try {
      final response = await _dio.get(ApiEndpoints.meOrder(orderId));
      final data = ApiResponseParser.dataMap(response);
      return CustomerOrderEntity.fromJson(data);
    } on DioException catch (e) {
      throw Exception(
        _extractErrorMessage(e, fallback: 'Không thể xem thông tin đơn hàng.'),
      );
    }
  }

  @override
  Future<CustomerOrderEntity> cancelOrder(
    String orderId, {
    required String reason,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.cancelMeOrder(orderId),
        data: {'reason': reason.trim()},
      );
      final data = ApiResponseParser.dataMap(response);
      return CustomerOrderEntity.fromJson(data);
    } on DioException catch (e) {
      throw Exception(
        _extractErrorMessage(
          e,
          fallback: 'Không thể hủy đơn hàng, vui lòng thử lại.',
        ),
      );
    }
  }

  @override
  Future<CustomerOrderEntity> decideCancellation(
    String orderId, {
    required bool approve,
    String? note,
  }) async {
    try {
      final body = <String, dynamic>{'approve': approve};
      if (note != null && note.trim().isNotEmpty) {
        body['note'] = note.trim();
      }
      final response = await _dio.post(
        ApiEndpoints.decideOrderCancellation(orderId),
        data: body,
      );
      return CustomerOrderEntity.fromJson(ApiResponseParser.dataMap(response));
    } on DioException catch (e) {
      throw Exception(
        _extractErrorMessage(
          e,
          fallback: 'Không thể xử lý quyết định hủy đơn.',
        ),
      );
    }
  }

  @override
  Future<void> submitReview(
    String orderId, {
    required int rating,
    String? comment,
  }) async {
    try {
      final body = <String, dynamic>{'rating': rating};
      if (comment != null && comment.trim().isNotEmpty) {
        body['comment'] = comment.trim();
      }
      await _dio.post(ApiEndpoints.orderReview(orderId), data: body);
    } on DioException catch (e) {
      throw Exception(
        _extractErrorMessage(e, fallback: 'Không thể gửi đánh giá dịch vụ.'),
      );
    }
  }

  @override
  Future<String?> getEvidenceSignedUrl(
    String orderId,
    String evidenceId,
  ) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.orderEvidence(orderId, evidenceId),
      );
      final data = ApiResponseParser.dataMap(response);
      return data['url']?.toString();
    } catch (_) {
      return null;
    }
  }
}
