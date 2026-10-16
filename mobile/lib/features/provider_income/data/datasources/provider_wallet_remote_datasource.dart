import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';

abstract class ProviderWalletRemoteDataSource {
  Future<Map<String, dynamic>> getWalletBalance();
  
  Future<List<dynamic>> getTransactions({
    int limit = 50,
    int offset = 0,
  });

  Future<Map<String, dynamic>> createMomoTopUp(double amount, {String? redirectUrl});

  Future<Map<String, dynamic>> createSepayTopUp(double amount);

  Future<Map<String, dynamic>> getTopUpDetail(String id);
}

class DioProviderWalletRemoteDataSource implements ProviderWalletRemoteDataSource {
  final Dio _dio;

  DioProviderWalletRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> getWalletBalance() async {
    final response = await _dio.get(ApiEndpoints.providerWallet);
    return response.data['data'] as Map<String, dynamic>;
  }

  @override
  Future<List<dynamic>> getTransactions({
    int limit = 50,
    int offset = 0,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.providerWalletTransactions,
      queryParameters: {
        'limit': limit,
        'offset': offset,
      },
    );
    return response.data['data'] as List<dynamic>;
  }

  @override
  Future<Map<String, dynamic>> createMomoTopUp(double amount, {String? redirectUrl}) async {
    final response = await _dio.post(
      ApiEndpoints.providerMomoTopup,
      data: {
        'amount': amount,
        if (redirectUrl != null) 'redirectUrl': redirectUrl,
      },
    );
    return response.data['data'] as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> createSepayTopUp(double amount) async {
    final response = await _dio.post(
      ApiEndpoints.providerSepayTopup,
      data: {
        'amount': amount,
      },
    );
    return response.data['data'] as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> getTopUpDetail(String id) async {
    final response = await _dio.get(ApiEndpoints.providerTopUpDetail(id));
    return response.data['data'] as Map<String, dynamic>;
  }
}
