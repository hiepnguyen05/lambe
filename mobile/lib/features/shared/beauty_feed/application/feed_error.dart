import 'package:dio/dio.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/network_exceptions.dart';

String feedError(Object error) => error is AppFailure
    ? error.message
    : error is DioException
    ? ExceptionHandler.handleDioError(error).message
    : 'Chưa đọc được dữ liệu Feed. Hãy thử tải lại.';
int? feedErrorStatus(Object error) => error is DioException
    ? error.response?.statusCode
    : error is AppFailure
    ? error.statusCode
    : null;
bool feedUncertain(Object error) =>
    feedErrorStatus(error) == null || (feedErrorStatus(error) ?? 0) >= 500;
