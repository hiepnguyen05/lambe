import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/network_exceptions.dart';

abstract class ProviderWalletRemoteDataSource {
  Future<Map<String, dynamic>> getWalletBalance();

  Future<List<dynamic>> getTransactions({int limit = 50});

  Future<Map<String, dynamic>> createMomoTopUp(
    double amount, {
    String? redirectUrl,
  });

  Future<Map<String, dynamic>> createSepayTopUp(double amount);

  Future<Map<String, dynamic>> getTopUpDetail(String id);
}

class DioProviderWalletRemoteDataSource
    implements ProviderWalletRemoteDataSource {
  final Dio _dio;

  DioProviderWalletRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> getWalletBalance() async {
    try {
      final response = await _dio.get(ApiEndpoints.providerWallet);
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tải thông tin ví.',
        ),
      );
    }
  }

  @override
  Future<List<dynamic>> getTransactions({int limit = 50}) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.providerWalletTransactions,
        queryParameters: {'limit': limit},
      );
      return ApiResponseParser.dataList(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tải lịch sử giao dịch ví.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> createMomoTopUp(
    double amount, {
    String? redirectUrl,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.providerMomoTopup,
        data: {
          'amount': amount,
          if (redirectUrl != null) 'redirectUrl': redirectUrl,
        },
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tạo giao dịch nạp MoMo.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> createSepayTopUp(double amount) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.providerSepayTopup,
        data: {'amount': amount},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể tạo giao dịch nạp SePay.',
        ),
      );
    }
  }

  @override
  Future<Map<String, dynamic>> getTopUpDetail(String id) async {
    try {
      final response = await _dio.get(ApiEndpoints.providerTopUpDetail(id));
      return ApiResponseParser.dataMap(response);
    } on DioException catch (e) {
      throw Exception(
        ExceptionHandler.extractMessage(
          e,
          fallback: 'Không thể kiểm tra trạng thái nạp tiền.',
        ),
      );
    }
  }
}
