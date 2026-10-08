import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/domain/value_objects/upload_payload.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/network_exceptions.dart';
import 'auth_remote_datasource.dart';

class DioAuthRemoteDataSource implements AuthRemoteDataSource {
  final Dio _dio;

  DioAuthRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> loginWithFirebase(String idToken) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.exchangeFirebaseToken,
        data: {'idToken': idToken},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> completeRegistration(
    String registrationToken,
    String fullName,
  ) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.completeRegistration,
        data: {'registrationToken': registrationToken, 'fullName': fullName},
      );
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> getCurrentUser() async {
    try {
      final response = await _dio.get(ApiEndpoints.me);
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> updateCurrentUser(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await _dio.patch(ApiEndpoints.me, data: data);
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> uploadAvatar(UploadPayload upload) async {
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          upload.bytes,
          filename: upload.fileName,
        ),
      });
      final response = await _dio.post(ApiEndpoints.meAvatar, data: formData);
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}
