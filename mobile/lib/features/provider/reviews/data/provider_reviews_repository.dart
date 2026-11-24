import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/network/network_exceptions.dart';

import '../domain/provider_review.dart';

final providerReviewsRepositoryProvider = Provider(
  (ref) => ProviderReviewsRepository(ref.watch(dioProvider)),
);

class ProviderReviewsRepository {
  final Dio _dio;
  ProviderReviewsRepository(this._dio);

  Future<ProviderReviewPage> list(
    String providerId, {
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.get(
        '/providers/$providerId/reviews',
        queryParameters: {'limit': 20, if (cursor != null) 'cursor': cursor},
        cancelToken: cancelToken,
      );
      return ProviderReviewPage.fromJson(ApiResponseParser.dataMap(response));
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    } on FormatException {
      throw const ServerFailure('Dữ liệu đánh giá không hợp lệ.');
    } on TypeError {
      throw const ServerFailure('Dữ liệu đánh giá không hợp lệ.');
    }
  }
}
