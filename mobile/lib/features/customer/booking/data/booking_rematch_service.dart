import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';

final bookingRematchServiceProvider = Provider<BookingRematchService>((ref) {
  return BookingRematchService(ref.watch(dioProvider));
});

class RematchOrderDraft {
  final ServiceItemEntity service;
  final Map<String, dynamic> orderDraft;

  const RematchOrderDraft({required this.service, required this.orderDraft});
}

class BookingRematchService {
  final Dio _dio;

  const BookingRematchService(this._dio);

  Future<RematchOrderDraft> load(String orderId) async {
    try {
      final response = await _dio.get(ApiEndpoints.rematchCandidates(orderId));
      final data = ApiResponseParser.dataMap(response);
      return RematchOrderDraft(
        service: ServiceItemEntity.fromJson(
          Map<String, dynamic>.from(data['service'] as Map),
        ),
        orderDraft: Map<String, dynamic>.from(data['orderDraft'] as Map),
      );
    } on DioException catch (error) {
      final data = error.response?.data;
      if (data is Map && data['message'] is String) {
        throw Exception(data['message']);
      }
      throw Exception(
        'Không thể tìm chuyên viên khác. Vui lòng kiểm tra kết nối và thử lại.',
      );
    }
  }
}
