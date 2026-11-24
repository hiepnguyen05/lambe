import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/provider_voucher_entity.dart';

abstract class ProviderVouchersRemoteDataSource {
  Future<List<ProviderVoucherEntity>> getProviderVouchers({
    int page = 1,
    int limit = 50,
  });
  Future<ProviderVoucherEntity> createProviderVoucher(
    Map<String, dynamic> data,
  );
  Future<void> disableProviderVoucher(String voucherId);
}

class DioProviderVouchersRemoteDataSource
    implements ProviderVouchersRemoteDataSource {
  final Dio _dio;

  DioProviderVouchersRemoteDataSource(this._dio);

  String _extractError(DioException e, {required String fallback}) {
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
  Future<List<ProviderVoucherEntity>> getProviderVouchers({
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.meProviderVouchers,
        queryParameters: {'page': page, 'limit': limit},
      );
      final list = ApiResponseParser.dataList(response);
      return list
          .whereType<Map<String, dynamic>>()
          .map((json) => ProviderVoucherEntity.fromJson(json))
          .toList();
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể tải danh sách ưu đãi của bạn.'),
      );
    }
  }

  @override
  Future<ProviderVoucherEntity> createProviderVoucher(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.meProviderVouchers,
        data: data,
      );
      final json = ApiResponseParser.dataMap(response);
      return ProviderVoucherEntity.fromJson(json);
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể tạo mã ưu đãi mới.'),
      );
    }
  }

  @override
  Future<void> disableProviderVoucher(String voucherId) async {
    try {
      await _dio.post(ApiEndpoints.disableProviderVoucher(voucherId));
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể ngừng mã ưu đãi này.'),
      );
    }
  }
}
