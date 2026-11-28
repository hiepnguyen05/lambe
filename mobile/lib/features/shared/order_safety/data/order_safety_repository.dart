import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/network/network_exceptions.dart';

import '../domain/order_safety.dart';

final orderSafetyRepositoryProvider = Provider(
  (ref) => OrderSafetyRepository(ref.watch(dioProvider)),
);

class OrderSafetyRepository {
  final Dio dio;
  OrderSafetyRepository(this.dio);
  Future<SafetyIncident> mine(SafetyScope scope, CancelToken cancel) async {
    return SafetyIncident.fromJson(
      ApiResponseParser.dataMap(await dio.get(scope.path, cancelToken: cancel)),
    );
  }

  Future<SafetyIncident> raise(
    SafetyScope scope,
    CancelToken cancel, {
    SafetyReason? reason,
    String? detail,
  }) async {
    final trimmed = detail?.trim();
    return SafetyIncident.fromJson(
      ApiResponseParser.dataMap(
        await dio.post(
          '${scope.path}/sos',
          data: <String, dynamic>{
            if (reason != null) 'reason': reason.apiValue,
            if (trimmed != null && trimmed.isNotEmpty) 'detail': trimmed,
          },
          cancelToken: cancel,
        ),
      ),
    );
  }

  Future<void> upload(SafetyScope scope, XFile file, CancelToken cancel) async {
    if (await file.length() > 5 * 1024 * 1024) {
      throw const ValidationFailure('Ảnh tối đa 5 MB.');
    }
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.name.split(RegExp(r'[/\\]')).last,
      ),
    });
    ApiResponseParser.ensureSuccess(
      await dio.post('${scope.path}/evidence', data: form, cancelToken: cancel),
    );
  }

  Future<String> evidenceUrl(
    SafetyScope scope,
    String id,
    CancelToken cancel,
  ) async {
    final json = ApiResponseParser.dataMap(
      await dio.get('${scope.path}/evidence/$id', cancelToken: cancel),
    );
    final url = json['url'];
    if (url is! String || Uri.tryParse(url)?.scheme != 'https') {
      throw const ServerFailure('Chưa mở được ảnh riêng tư.');
    }
    return url;
  }

  static String message(Object error) => error is AppFailure
      ? error.message
      : error is DioException
      ? ExceptionHandler.handleDioError(error).message
      : 'Chưa xác nhận được với máy chủ. Vui lòng kiểm tra lại trạng thái.';
}
