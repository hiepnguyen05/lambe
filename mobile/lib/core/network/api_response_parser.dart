import 'package:dio/dio.dart';

import '../error/app_failure.dart';

class ApiResponseParser {
  const ApiResponseParser._();

  static Map<String, dynamic> dataMap(Response<dynamic> response) {
    final data = _data(response);
    if (data is! Map) {
      throw const ServerFailure('Phản hồi máy chủ không đúng định dạng.');
    }
    return Map<String, dynamic>.from(data);
  }

  static List<dynamic> dataList(Response<dynamic> response) {
    final data = _data(response);
    if (data is! List) {
      throw const ServerFailure('Phản hồi máy chủ không đúng định dạng.');
    }
    return List<dynamic>.from(data);
  }

  static void ensureSuccess(Response<dynamic> response) {
    _envelope(response);
  }

  static dynamic _data(Response<dynamic> response) {
    final envelope = _envelope(response);
    if (!envelope.containsKey('data')) {
      throw const ServerFailure('Phản hồi máy chủ thiếu dữ liệu.');
    }
    return envelope['data'];
  }

  static Map<String, dynamic> _envelope(Response<dynamic> response) {
    final raw = response.data;
    if (raw is! Map) {
      throw const ServerFailure('Phản hồi máy chủ không đúng định dạng.');
    }

    final envelope = Map<String, dynamic>.from(raw);
    if (envelope['success'] != true) {
      final message = envelope['message']?.toString();
      throw ServerFailure(
        message == null || message.isEmpty
            ? 'Thao tác không thành công.'
            : message,
        response.statusCode,
      );
    }
    return envelope;
  }
}
