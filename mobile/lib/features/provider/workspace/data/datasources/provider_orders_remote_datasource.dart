import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/network_exceptions.dart';

abstract class ProviderOrdersRemoteDataSource {
  Future<List<Map<String, dynamic>>> getUpcomingOrders({
    CancelToken? cancelToken,
  });
  Future<List<Map<String, dynamic>>> getPendingOrders();
  Future<List<Map<String, dynamic>>> getAllProviderOrders({String? status});
  Future<Map<String, dynamic>> getProviderOrderDetail(String orderId);
  Future<Map<String, dynamic>> acceptOrder(String orderId);
  Future<Map<String, dynamic>> rejectOrder(
    String orderId, {
    required String reason,
  });
  Future<Map<String, dynamic>> cancelOrder(
    String orderId, {
    required String reason,
  });
  Future<Map<String, dynamic>> markEnRoute(String orderId);
  Future<Map<String, dynamic>> markArrived(
    String orderId, {
    required double latitude,
    required double longitude,
    required double accuracyMeters,
    required DateTime capturedAt,
  });
  Future<Map<String, dynamic>> startOrder(String orderId);
  Future<Map<String, dynamic>> pauseWork(String orderId);
  Future<Map<String, dynamic>> resumeWork(String orderId);
  Future<Map<String, dynamic>> completeOrder(
    String orderId, {
    required bool cashReceived,
  });
  Future<Map<String, dynamic>> uploadEvidence(
    String orderId,
    String type,
    String filePath, {
    double? latitude,
    double? longitude,
  });
  Future<void> recordContactAttempt(String orderId);
  Future<void> requestCancellation(
    String orderId, {
    required String reason,
    String? detail,
  });
  Future<String?> getEvidenceSignedUrl(String orderId, String evidenceId);
}

class DioProviderOrdersRemoteDataSource
    implements ProviderOrdersRemoteDataSource {
  final Dio _dio;

  DioProviderOrdersRemoteDataSource(this._dio);

  @override
  Future<List<Map<String, dynamic>>> getUpcomingOrders({
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.get(
      '${ApiEndpoints.meProviderOrders}/upcoming',
      cancelToken: cancelToken,
    );
    return ApiResponseParser.dataList(response)
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  @override
  Future<List<Map<String, dynamic>>> getPendingOrders() async {
    try {
      final response = await _dio.get(
        ApiEndpoints.meProviderOrders,
        queryParameters: {'status': 'PENDING_PROVIDER'},
      );
      final list = ApiResponseParser.dataList(response);
      return list.whereType<Map<String, dynamic>>().toList();
    } catch (e) {
      if (e is DioException &&
          (e.response?.statusCode == 404 || e.response?.statusCode == 401)) {
        return [];
      }
      rethrow;
    }
  }

  @override
  Future<List<Map<String, dynamic>>> getAllProviderOrders({
    String? status,
  }) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.meProviderOrders,
        queryParameters: status != null ? {'status': status} : null,
      );
      final list = ApiResponseParser.dataList(response);
      return list.whereType<Map<String, dynamic>>().toList();
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tải danh sách đơn của thợ.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> getProviderOrderDetail(String orderId) async {
    try {
      final response = await _dio.get(ApiEndpoints.meProviderOrder(orderId));
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tải chi tiết đơn hàng.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> acceptOrder(String orderId) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.acceptProviderOrder(orderId),
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể nhận đơn hàng.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> rejectOrder(
    String orderId, {
    required String reason,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.rejectProviderOrder(orderId),
        data: {'reason': reason.trim()},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể từ chối đơn hàng.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> cancelOrder(
    String orderId, {
    required String reason,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.cancelProviderOrder(orderId),
        data: {'reason': reason.trim()},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(e, fallback: 'Không thể hủy đơn hàng.'),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> markEnRoute(String orderId) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.enRouteProviderOrder(orderId),
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể cập nhật bắt đầu di chuyển.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> markArrived(
    String orderId, {
    required double latitude,
    required double longitude,
    required double accuracyMeters,
    required DateTime capturedAt,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.arriveProviderOrder(orderId),
        data: {
          'latitude': latitude,
          'longitude': longitude,
          'accuracyMeters': accuracyMeters,
          'capturedAt': capturedAt.toUtc().toIso8601String(),
        },
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể cập nhật đã đến nơi.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> startOrder(String orderId) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.startProviderOrder(orderId),
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể cập nhật bắt đầu dịch vụ.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> pauseWork(String orderId) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.pauseProviderOrderWork(orderId),
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tạm dừng công việc.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> resumeWork(String orderId) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.resumeProviderOrderWork(orderId),
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tiếp tục công việc.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> completeOrder(
    String orderId, {
    required bool cashReceived,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.completeProviderOrder(orderId),
        data: {'cashReceived': cashReceived},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể hoàn thành đơn hàng.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> uploadEvidence(
    String orderId,
    String type,
    String filePath, {
    double? latitude,
    double? longitude,
  }) async {
    try {
      final fileName = filePath.split(RegExp(r'[\\/]')).last;
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });

      final queryParams = <String, dynamic>{};
      if (latitude != null && longitude != null) {
        queryParams['latitude'] = latitude;
        queryParams['longitude'] = longitude;
      }

      final response = await _dio.post(
        ApiEndpoints.providerOrderEvidence(orderId, type),
        data: formData,
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tải ảnh bằng chứng lên.',
        ),
      );
    }
  }

  @override
  Future<void> recordContactAttempt(String orderId) async {
    try {
      await _dio.post(ApiEndpoints.providerOrderContactAttempt(orderId));
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể ghi nhận liên hệ khách.',
        ),
      );
    }
  }

  @override
  Future<void> requestCancellation(
    String orderId, {
    required String reason,
    String? detail,
  }) async {
    try {
      final body = <String, dynamic>{'reason': reason.trim()};
      if (detail != null && detail.trim().isNotEmpty) {
        body['detail'] = detail.trim();
      }
      await _dio.post(
        ApiEndpoints.providerOrderCancellationRequest(orderId),
        data: body,
      );
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể gửi yêu cầu hủy đơn.',
        ),
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
      return ApiResponseParser.dataMap(response)['url']?.toString();
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tải ảnh bằng chứng.',
        ),
      );
    }
  }
}
