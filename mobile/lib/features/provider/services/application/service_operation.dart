import 'package:dio/dio.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/network_exceptions.dart';

String serviceError(Object error) => error is AppFailure
    ? error.message
    : error is DioException
    ? ExceptionHandler.handleDioError(error).message
    : 'Chưa xác nhận được dữ liệu với máy chủ. Vui lòng tải lại.';
bool serviceOutcomeUnknown(Object error) =>
    error is! DioException ||
    error.type != DioExceptionType.badResponse ||
    (error.response?.statusCode ?? 0) >= 500;
