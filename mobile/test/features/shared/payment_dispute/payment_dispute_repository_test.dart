import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/payment_dispute/data/payment_dispute_repository.dart';

import 'support/payment_dispute_fakes.dart';

void main() {
  test('reads each role endpoint and sends only normalized reason', () async {
    final dio = Dio();
    final requests = <RequestOptions>[];
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'statusCode': 200,
                'data': orderJson(status: 'PAYMENT_DISPUTE'),
              },
            ),
          );
        },
      ),
    );
    final repo = PaymentDisputeRepository(dio);
    await repo.read(customerScope, CancelToken());
    await repo.read(providerScope, CancelToken());
    await repo.open(providerScope, '  $reason ', CancelToken());
    await expectLater(
      () => repo.open(customerScope, reason, CancelToken()),
      throwsArgumentError,
    );
    expect(requests, hasLength(3));
    expect(requests.map((r) => r.path).toList(), [
      '/me/orders/order',
      '/me/provider/orders/order',
      '/me/provider/orders/order/payment-dispute',
    ]);
    expect(requests.last.method, 'POST');
    expect(requests.last.data, {'reason': reason});
    expect(requests.last.cancelToken, isNotNull);
  });
  for (final invalid in [
    {...orderJson(), 'id': 'another-order'},
    {...orderJson(), 'totalAmount': -1},
    {
      ...orderJson(),
      'commissionHold': {'amount': -3, 'status': 'ACTIVE'},
    },
    {
      ...orderJson(),
      'commissionHold': {'amount': 30000, 'status': 'UNKNOWN'},
    },
  ]) {
    test(
      'rejects mismatched order or malformed financial snapshot $invalid',
      () async {
        final dio = Dio();
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) => handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'success': true, 'data': invalid},
              ),
            ),
          ),
        );
        expect(
          () =>
              PaymentDisputeRepository(dio).read(providerScope, CancelToken()),
          throwsFormatException,
        );
      },
    );
  }
}
