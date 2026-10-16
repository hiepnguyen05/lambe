import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';

abstract class ProviderOrdersRemoteDataSource {
  Future<List<Map<String, dynamic>>> getPendingOrders();
  Future<Map<String, dynamic>> acceptOrder(String orderId);
  Future<Map<String, dynamic>> rejectOrder(String orderId, {required String reason});
}

class DioProviderOrdersRemoteDataSource implements ProviderOrdersRemoteDataSource {
  final Dio _dio;

  DioProviderOrdersRemoteDataSource(this._dio);

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
      if (e is DioException && (e.response?.statusCode == 404 || e.response?.statusCode == 401)) {
        return [];
      }
      rethrow;
    }
  }

  @override
  Future<Map<String, dynamic>> acceptOrder(String orderId) async {
    final response = await _dio.post(ApiEndpoints.acceptProviderOrder(orderId));
    return ApiResponseParser.dataMap(response);
  }

  @override
  Future<Map<String, dynamic>> rejectOrder(String orderId, {required String reason}) async {
    final response = await _dio.post(
      ApiEndpoints.rejectProviderOrder(orderId),
      data: {'reason': reason},
    );
    return ApiResponseParser.dataMap(response);
  }
}
