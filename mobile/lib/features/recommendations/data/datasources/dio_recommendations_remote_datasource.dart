import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/network_exceptions.dart';
import 'recommendations_remote_datasource.dart';

class DioRecommendationsRemoteDataSource
    implements RecommendationsRemoteDataSource {
  final Dio _dio;

  DioRecommendationsRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> getServices({required int limit}) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.serviceRecommendations,
        queryParameters: {'limit': limit},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}
