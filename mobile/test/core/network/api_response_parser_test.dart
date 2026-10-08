import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/api_response_parser.dart';

void main() {
  Response<dynamic> response(dynamic data, {int statusCode = 200}) {
    return Response<dynamic>(
      requestOptions: RequestOptions(path: '/test'),
      data: data,
      statusCode: statusCode,
    );
  }

  group('ApiResponseParser', () {
    test('returns a typed map from a successful envelope', () {
      final result = ApiResponseParser.dataMap(
        response({
          'success': true,
          'data': {'id': 'user-1'},
        }),
      );

      expect(result, {'id': 'user-1'});
    });

    test('returns a list from a successful envelope', () {
      final result = ApiResponseParser.dataList(
        response({
          'success': true,
          'data': [1, 2],
        }),
      );

      expect(result, [1, 2]);
    });

    test('keeps the API message when success is false', () {
      expect(
        () => ApiResponseParser.ensureSuccess(
          response({'success': false, 'message': 'Không hợp lệ'}),
        ),
        throwsA(
          isA<ServerFailure>().having(
            (failure) => failure.message,
            'message',
            'Không hợp lệ',
          ),
        ),
      );
    });

    test('rejects malformed data instead of casting at runtime', () {
      expect(
        () => ApiResponseParser.dataMap(
          response({'success': true, 'data': <dynamic>[]}),
        ),
        throwsA(isA<ServerFailure>()),
      );
    });
  });
}
