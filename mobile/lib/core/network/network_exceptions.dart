import 'package:dio/dio.dart';

abstract class AppFailure implements Exception {
  final String message;
  final int? statusCode;

  const AppFailure(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class NetworkFailure extends AppFailure {
  const NetworkFailure([super.message = 'Không có kết nối Internet hoặc lỗi mạng.', super.statusCode]);
}

class ServerFailure extends AppFailure {
  const ServerFailure([super.message = 'Hệ thống gặp sự cố. Vui lòng thử lại sau.', super.statusCode]);
}

class UnauthorizedFailure extends AppFailure {
  const UnauthorizedFailure([super.message = 'Phiên đăng nhập đã hết hạn.', super.statusCode = 401]);
}

class ValidationFailure extends AppFailure {
  const ValidationFailure([super.message = 'Dữ liệu đầu vào không hợp lệ.', super.statusCode = 400]);
}

class ExceptionHandler {
  static AppFailure handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return const NetworkFailure('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.');

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
