import 'package:dio/dio.dart';

import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/utils/currency_utils.dart';

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

  /// Extracts a human-readable message from a [DioException], preferring any
  /// [AppFailure] already attached by the Dio error interceptor.
  static String extractMessage(
    DioException error, {
    String fallback = 'Thao tác không thành công',
  }) {
    final walletMessage = _walletBalanceMessage(error.response?.data);
    if (walletMessage != null) return walletMessage;
    final attached = error.error;
    if (attached is AppFailure && attached.message.isNotEmpty) {
      return attached.message;
    }
    final parsed = handleDioError(error).message;
    if (parsed.isNotEmpty && parsed != 'Thao tác không thành công') {
      return parsed;
    }
    return fallback;
  }

  static String? _walletBalanceMessage(Object? data) {
    if (data is! Map || data['code'] != 'PROVIDER_WALLET_BALANCE_TOO_LOW') {
      return null;
    }
    final available = data['availableBalance'];
    final minimum = data['minimumBalance'];
    if (available is! num || minimum is! num) return null;
    final formatter = CurrencyUtils.vndDecimal;
    final shortfall = (minimum - available).clamp(0, double.infinity);
    return 'Số dư khả dụng ${formatter.format(available)}đ. '
        'Cần tối thiểu ${formatter.format(minimum)}đ để bật nhận đơn. '
        'Vui lòng nạp thêm ${formatter.format(shortfall)}đ.';
  }
}
