import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

/// Tín hiệu phát đi khi phiên đăng nhập hết hạn hoàn toàn và cần buộc đăng xuất
final sessionExpiredSignalProvider = StateProvider<int>((ref) => 0);

/// Provider cung cấp instance riêng của Dio dùng cho việc làm mới token
final refreshDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: ApiEndpoints.connectionTimeout,
      receiveTimeout: ApiEndpoints.receiveTimeout,
      contentType: 'application/json',
    ),
  );
});

/// Provider cung cấp instance của Dio dùng chung cho toàn bộ ứng dụng
final dioProvider = Provider<Dio>((ref) {
  ApiEndpoints.validateForRelease();
  final options = BaseOptions(
    baseUrl: ApiEndpoints.baseUrl,
    connectTimeout: ApiEndpoints.connectionTimeout,
    receiveTimeout: ApiEndpoints.receiveTimeout,
    contentType: 'application/json',
  );

  final dio = Dio(options);
  final secureStorage = ref.read(secureStorageProvider);
  final refreshDio = ref.watch(refreshDioProvider);

  // Biến giữ future làm mới token đang chạy dở để gộp (deduplicate) các 401 đồng thời
  Future<String?>? activeRefreshFuture;

  Future<void> handleSessionExpired() async {
    await secureStorage.clearAll();
    ref.read(sessionExpiredSignalProvider.notifier).state++;
  }

  Future<String?> performTokenRefresh() async {
    final refreshToken = await secureStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await handleSessionExpired();
      return null;
    }

    try {
      final res = await refreshDio.post<Map<String, dynamic>>(
        ApiEndpoints.refreshToken,
        data: {'refreshToken': refreshToken},
      );
      final payload = res.data?['data'];
      if (payload is Map<String, dynamic>) {
        final newAccess = payload['accessToken'] as String?;
        final newRefresh = payload['refreshToken'] as String?;
        if (newAccess != null && newAccess.isNotEmpty) {
          await secureStorage.saveAccessToken(newAccess);
          if (newRefresh != null && newRefresh.isNotEmpty) {
            await secureStorage.saveRefreshToken(newRefresh);
          }
          return newAccess;
        }
      }
      await handleSessionExpired();
      return null;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 400 || status == 401 || status == 403 || status == 404) {
        await handleSessionExpired();
      }
      return null;
    } catch (_) {
      // Lỗi mạng/timeout: giữ nguyên token để thử lại khi có kết nối
      return null;
    }
  }

  // Auth Interceptor
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (kDebugMode &&
            (options.path.startsWith('/orders') ||
                options.path.startsWith('/me/provider/orders'))) {
          options.extra['_orderTiming'] = Stopwatch()..start();
        }
        final token = await secureStorage.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        final timer = response.requestOptions.extra.remove('_orderTiming');
        if (timer is Stopwatch) {
          debugPrint(
            '[Order API] ${response.requestOptions.method} '
            '${response.requestOptions.path}: ${timer.elapsedMilliseconds} ms '
            '(${response.statusCode})',
          );
        }
        handler.next(response);
      },
      onError: (DioException e, handler) async {
        final timer = e.requestOptions.extra.remove('_orderTiming');
        if (timer is Stopwatch) {
          debugPrint(
            '[Order API] ${e.requestOptions.method} ${e.requestOptions.path}: '
            '${timer.elapsedMilliseconds} ms (${e.response?.statusCode ?? e.type.name})',
          );
        }
        final path = e.requestOptions.path;
        final isAuthRequest =
            path.contains('/auth/firebase') ||
            path.contains('/auth/refresh') ||
            path.contains('/auth/complete-registration');

        if (e.response?.statusCode == 401 &&
            !isAuthRequest &&
            e.requestOptions.extra['_isRetry'] != true) {
          // Gộp tất cả yêu cầu 401 đồng thời vào cùng một tiến trình làm mới token
          activeRefreshFuture ??= performTokenRefresh().whenComplete(() {
            activeRefreshFuture = null;
          });

          final newAccess = await activeRefreshFuture;
          if (newAccess != null && newAccess.isNotEmpty) {
            final retryOptions = e.requestOptions;
            if (retryOptions.data is FormData) {
              retryOptions.data = (retryOptions.data as FormData).clone();
            }
            retryOptions.headers['Authorization'] = 'Bearer $newAccess';
            retryOptions.extra['_isRetry'] = true;
            try {
              final retryResponse = await dio.fetch(retryOptions);
              return handler.resolve(retryResponse);
            } on DioException catch (retryErr) {
              final appFailure = ExceptionHandler.handleDioError(retryErr);
              return handler.next(
                retryErr.copyWith(error: appFailure, message: appFailure.message),
              );
            }
          }
        }

        final appFailure = ExceptionHandler.handleDioError(e);
        return handler.next(
          e.copyWith(error: appFailure, message: appFailure.message),
        );
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
