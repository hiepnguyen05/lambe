import 'package:dio/dio.dart';

import '../error/app_failure.dart';

class ExceptionHandler {
  static AppFailure handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return const NetworkFailure(
          'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.',
        );

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        String errorMessage = 'Thao tác không thành công';

        if (data is Map && data.containsKey('message')) {
          final msg = data['message'];
          errorMessage = msg is List ? msg.join(', ') : msg.toString();
        }

        if (statusCode == 401) {
          return UnauthorizedFailure(errorMessage, statusCode);
        } else if (statusCode == 400 || statusCode == 422) {
          return ValidationFailure(errorMessage, statusCode);
        } else if (statusCode == 429) {
          return ValidationFailure(errorMessage, statusCode);
        }
        return ServerFailure(errorMessage, statusCode);

      case DioExceptionType.cancel:
        return const NetworkFailure('Yêu cầu đã bị hủy.');

      default:
        return ServerFailure(error.message ?? 'Đã xảy ra lỗi không xác định.');
    }
  }
}
