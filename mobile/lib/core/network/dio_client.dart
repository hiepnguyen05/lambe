import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/api_endpoints.dart';
import '../storage/secure_storage_service.dart';

// Provider cung cấp instance của Dio dùng chung cho toàn bộ ứng dụng
final dioProvider = Provider<Dio>((ref) {
  final options = BaseOptions(
    baseUrl: ApiEndpoints.baseUrl,
    connectTimeout: ApiEndpoints.connectionTimeout,
    receiveTimeout: ApiEndpoints.receiveTimeout,
    contentType: 'application/json',
  );

  final dio = Dio(options);

  // Đọc SecureStorage thông qua provider
  final secureStorage = ref.read(secureStorageProvider);

  // Auth Interceptor
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await secureStorage.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) {
        if (e.response?.statusCode == 401) {
          // Có thể emit event logout ở đây hoặc xử lý refresh token
        }
        return handler.next(e);
      },
    ),
  );

  // Interceptor để dễ debug API (Chỉ chạy trên Debug Mode)
  dio.interceptors.add(
    LogInterceptor(
      request: kDebugMode,
      requestHeader: false,
      requestBody: false,
      responseHeader: false,
      responseBody: false,
      error: kDebugMode,
    ),
  );

  return dio;
});
