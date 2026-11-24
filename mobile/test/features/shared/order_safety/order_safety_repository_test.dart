import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/features/shared/order_safety/data/order_safety_repository.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

void main() {
  for (final role in SafetyRole.values) {
    test(
      '$role uses the authenticated role endpoint, no photo or description for SOS',
      () async {
        final dio = Dio();
        final requests = <RequestOptions>[];
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              requests.add(options);
              handler.resolve(
                Response(
                  requestOptions: options,
                  data: {
                    'success': true,
                    'data': {'id': 'incident', 'status': 'OPEN'},
                  },
                ),
              );
            },
          ),
        );
        final scope = SafetyScope('order', role);
        final repository = OrderSafetyRepository(dio);
        await repository.raise(scope, CancelToken());
        await repository.mine(scope, CancelToken());
        final prefix = role == SafetyRole.customer
            ? '/me/orders/order/safety'
            : '/me/provider/orders/order/safety';
        expect(requests[0].path, '$prefix/sos');
        expect(requests[0].method, 'POST');
        expect(requests[0].data, isEmpty);
        expect(requests[1].path, prefix);
      },
    );
  }

  test('evidence upload streams one file to private safety endpoint', () async {
    final directory = await Directory.systemTemp.createTemp(
      'lambe-safety-test',
    );
    addTearDown(() => directory.delete(recursive: true));
    final file = File('${directory.path}/proof.jpg');
    await file.writeAsBytes([255, 216, 255, 217]);
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          expect(options.path, '/me/orders/order/safety/evidence');
          final form = options.data as FormData;
          expect(form.files.single.key, 'file');
          expect(form.files.single.value.filename, 'proof.jpg');
          handler.resolve(
            Response(requestOptions: options, data: {'success': true}),
          );
        },
      ),
    );
    await OrderSafetyRepository(dio).upload(
      const SafetyScope('order', SafetyRole.customer),
      XFile(file.path),
      CancelToken(),
    );
  });

  test('rejects oversized file before any upload', () async {
    final directory = await Directory.systemTemp.createTemp(
      'lambe-safety-test',
    );
    addTearDown(() => directory.delete(recursive: true));
    final file = File('${directory.path}/large.jpg');
    final handle = await file.open(mode: FileMode.write);
    await handle.truncate(5 * 1024 * 1024 + 1);
    await handle.close();
    await expectLater(
      OrderSafetyRepository(Dio()).upload(
        const SafetyScope('order', SafetyRole.provider),
        XFile(file.path),
        CancelToken(),
      ),
      throwsA(isA<ValidationFailure>()),
    );
  });

  test(
    'fetches a new signed URL on each open and rejects insecure URL',
    () async {
      final dio = Dio();
      var gets = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            gets++;
            expect(
              options.path,
              '/me/provider/orders/order/safety/evidence/proof',
            );
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'success': true,
                  'data': {
                    'url': gets < 3
                        ? 'https://example.com/signed-$gets'
                        : 'http://example.com/insecure',
                  },
                },
              ),
            );
          },
        ),
      );
      final repository = OrderSafetyRepository(dio);
      const scope = SafetyScope('order', SafetyRole.provider);
      expect(
        await repository.evidenceUrl(scope, 'proof', CancelToken()),
        endsWith('signed-1'),
      );
      expect(
        await repository.evidenceUrl(scope, 'proof', CancelToken()),
        endsWith('signed-2'),
      );
      await expectLater(
        repository.evidenceUrl(scope, 'proof', CancelToken()),
        throwsA(isA<ServerFailure>()),
      );
    },
  );
}
