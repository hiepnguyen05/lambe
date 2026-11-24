import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/features/provider/services/data/service_change_media_repository.dart';

void main() {
  final png = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10]);
  test('uploads a private document under the request using a generic filename, then deletes it', () async {
    final dio = Dio();
    final sent = <RequestOptions>[];
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          sent.add(options);
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {'id': 'doc', 'type': 'PORTFOLIO', 'status': 'PENDING'},
              },
            ),
          );
        },
      ),
    );
    final media = ServiceChangeMediaRepository(dio, Dio());
    final result = await media.upload(
      'request',
      'PORTFOLIO',
      XFile.fromData(png, name: 'sensitive-original-name.png'),
      CancelToken(),
    );
    expect(result.id, 'doc');
    expect(
      sent.single.path,
      '/me/provider/service-change-requests/request/documents/PORTFOLIO',
    );
    final payload = sent.single.data as FormData;
    expect(payload.files.single.key, 'file');
    expect(payload.files.single.value.filename, 'document.png');
    await media.remove('request', 'doc', CancelToken());
    expect(sent.last.method, 'DELETE');
    expect(
      sent.last.path,
      '/me/provider/service-change-requests/request/documents/doc',
    );
  });
  test(
    'invalid type, SVG, empty and oversized uploads stop before network',
    () async {
      final dio = Dio();
      var writes = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (_, handler) {
            writes++;
            handler.reject(DioException(requestOptions: RequestOptions()));
          },
        ),
      );
      final media = ServiceChangeMediaRepository(dio, Dio());
      for (final bytes in [
        Uint8List(0),
        Uint8List.fromList('<svg></svg>'.codeUnits),
        Uint8List(maxServiceDocumentBytes + 1),
      ]) {
        await expectLater(
          () => media.upload(
            'request',
            'PORTFOLIO',
            XFile.fromData(bytes),
            CancelToken(),
          ),
          throwsA(isA<ValidationFailure>()),
        );
      }
      await expectLater(
        () => media.upload(
          'request',
          'ID_CARD_FRONT',
          XFile.fromData(png),
          CancelToken(),
        ),
        throwsA(isA<ValidationFailure>()),
      );
      expect(writes, 0);
    },
  );
  test('image access is authorized by Lambe but signed download carries no Lambe token', () async {
    final api = Dio(
      BaseOptions(headers: {'Authorization': 'Bearer unit-test-token'}),
    );
    final download = Dio();
    var reads = 0;
    api.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          reads++;
          expect(
            options.path,
            '/me/provider/service-change-requests/request/documents/doc/access',
          );
          expect(options.headers['Authorization'], 'Bearer unit-test-token');
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {
                  'url': 'https://api.cloudinary.com/private-image?signature=test-only',
                },
              },
            ),
          );
        },
      ),
    );
    download.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          expect(options.headers.containsKey('Authorization'), isFalse);
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: ResponseBody.fromBytes(png, 200),
            ),
          );
        },
      ),
    );
    final media = ServiceChangeMediaRepository(api, download);
    expect(await media.image('request', 'doc', CancelToken()), png);
    expect(await media.image('request', 'doc', CancelToken()), png);
    expect(reads, 2); // Each view obtains a fresh URL; there is no URL cache.
  });
  for (final url in [
    'http://api.cloudinary.com/image',
    'https://example.test/image',
    'https://api.cloudinary.com.evil.test/image',
  ]) {
    test(
      'does not download from an untrusted or insecure signed URL $url',
      () async {
        final api = Dio();
        api.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) => handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': {'url': url},
                },
              ),
            ),
          ),
        );
        await expectLater(
          () => ServiceChangeMediaRepository(
            api,
            Dio(),
          ).image('request', 'doc', CancelToken()),
          throwsA(isA<ServerFailure>()),
        );
      },
    );
  }
  test('private image stream enforces the same size limit as upload', () async {
    final api = Dio(), download = Dio();
    api.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {
              'success': true,
              'data': {'url': 'https://api.cloudinary.com/private'},
            },
          ),
        ),
      ),
    );
    download.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: ResponseBody.fromBytes(
              Uint8List(maxServiceDocumentBytes + 1),
              200,
            ),
          ),
        ),
      ),
    );
    expect(
      () => ServiceChangeMediaRepository(
        api,
        download,
      ).image('request', 'doc', CancelToken()),
      throwsA(isA<ServerFailure>()),
    );
  });
}
