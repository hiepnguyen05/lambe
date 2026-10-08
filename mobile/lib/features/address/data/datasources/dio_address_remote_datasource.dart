import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/network_exceptions.dart';
import 'address_remote_datasource.dart';

class DioAddressRemoteDataSource implements AddressRemoteDataSource {
  final Dio _dio;

  DioAddressRemoteDataSource(this._dio);

  @override
  Future<List<dynamic>> getAddresses() {
    return _listRequest(() => _dio.get(ApiEndpoints.meAddresses));
  }

  @override
  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> data) {
    return _mapRequest(() => _dio.post(ApiEndpoints.meAddresses, data: data));
  }

  @override
  Future<Map<String, dynamic>> updateAddress(
    String id,
    Map<String, dynamic> data,
  ) {
    return _mapRequest(
      () => _dio.patch(ApiEndpoints.meAddress(id), data: data),
    );
  }

  @override
  Future<void> setDefaultAddress(String id) {
    return _voidRequest(() => _dio.put(ApiEndpoints.defaultAddress(id)));
  }

  @override
  Future<void> deleteAddress(String id) {
    return _voidRequest(() => _dio.delete(ApiEndpoints.meAddress(id)));
  }

  Future<Map<String, dynamic>> _mapRequest(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      return ApiResponseParser.dataMap(await request());
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  Future<List<dynamic>> _listRequest(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      return ApiResponseParser.dataList(await request());
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  Future<void> _voidRequest(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      ApiResponseParser.ensureSuccess(await request());
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}
