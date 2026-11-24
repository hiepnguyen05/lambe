import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_provider_candidate_entity.dart';

import '../domain/provider_search_request.dart';

final providerDiscoveryRepositoryProvider = Provider(
  (ref) => ProviderDiscoveryRepository(ref.watch(dioProvider)),
);

class ProviderDiscoveryRepository {
  final Dio _dio;
  ProviderDiscoveryRepository(this._dio);

  Future<List<BookingProviderCandidateEntity>> search(
    ProviderSearchRequest request, {
    CancelToken? cancelToken,
  }) async {
    final body = request.toJson();
    try {
      final response = await _dio.post(
        ApiEndpoints.providerDiscoverySearch,
        data: body,
        cancelToken: cancelToken,
      );
      return ApiResponseParser.dataList(response).map((row) {
        if (row is! Map<String, dynamic>) {
          throw const FormatException('Invalid candidate');
        }
        return BookingProviderCandidateEntity.fromJson(row);
      }).toList();
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    } on FormatException {
      throw const ServerFailure(
        'Dữ liệu chuyên viên không hợp lệ. Vui lòng thử lại.',
      );
    }
  }
}

final nearbyProvidersProvider = FutureProvider.autoDispose
    .family<List<BookingProviderCandidateEntity>, ProviderSearchRequest>((
      ref,
      request,
    ) {
      final cancel = CancelToken();
      ref.onDispose(() => cancel.cancel());
      return ref
          .watch(providerDiscoveryRepositoryProvider)
          .search(request, cancelToken: cancel);
    });
