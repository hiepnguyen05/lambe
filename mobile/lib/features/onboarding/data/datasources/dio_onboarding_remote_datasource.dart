import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/network_exceptions.dart';
import 'onboarding_remote_datasource.dart';

class DioOnboardingRemoteDataSource implements OnboardingRemoteDataSource {
  final Dio _dio;

  DioOnboardingRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> getOptions() async {
    try {
      final response = await _dio.get(ApiEndpoints.onboardingOptions);
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<Map<String, dynamic>> getCurrentPreferences() async {
    try {
      final response = await _dio.get(ApiEndpoints.onboarding);
      return ApiResponseParser.dataMap(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> saveOnboardingData(Map<String, dynamic> data) async {
    try {
      final response = await _dio.put(ApiEndpoints.onboarding, data: data);
      ApiResponseParser.ensureSuccess(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> completeOnboarding() async {
    try {
      final response = await _dio.post(ApiEndpoints.onboardingComplete);
      ApiResponseParser.ensureSuccess(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> skipOnboarding() async {
    try {
      final response = await _dio.post(ApiEndpoints.onboardingSkip);
      ApiResponseParser.ensureSuccess(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}
