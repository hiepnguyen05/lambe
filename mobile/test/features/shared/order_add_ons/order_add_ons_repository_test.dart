import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_add_ons/data/order_add_ons_repository.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';

import 'support/add_on_fakes.dart';

void main() {
  test(
    'option availability, exact totals and commissions are parsed from server',
    () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(options.path, '/me/provider/orders/order/add-on-options');
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'success': true,
                  'data': [optionJson(available: false)],
                },
              ),
            );
          },
        ),
      );
      final rows = await OrderAddOnsRepository(dio)
          .options(providerScope, CancelToken());
      expect(rows.single.available, isFalse);
      expect(rows.single.reason, 'PROVIDER_TIME_CONFLICT');
      expect(rows.single.proposedTotalAmount, 178000);
      expect(rows.single.commissionAmount, 6000);
    },
  );
  test(
    'proposal sends only offering/note and the required idempotency header',
    () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(options.path, '/me/provider/orders/order/add-ons');
            expect(options.method, 'POST');
            expect(options.headers['Idempotency-Key'], 'same-intent-key');
            expect(options.data, {
              'providerServiceId': 'offering-extra',
              'note': 'Màu nâu',
            });
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: {'success': true, 'data': addOnJson()},
              ),
            );
          },
        ),
      );
      await OrderAddOnsRepository(dio).propose(
        providerScope,
        'offering-extra',
        'Màu nâu',
        'same-intent-key',
        CancelToken(),
      );
    },
  );
  test(
    'decision pins addOnId in path and returns the exact server order snapshot',
    () async {
      final dio = Dio();
      final json = {
        ...orderJson(items: [addOnJson(status: 'ACCEPTED')]),
        'totalAmount': 178007,
        'commissionAmount': 24009,
      };
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(options.path, '/me/orders/order/add-ons/extra/decision');
            expect(options.data, {'approve': true});
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'success': true,
                  'data': {
                    'addOn': addOnJson(status: 'ACCEPTED'),
                    'order': json,
                  },
                },
              ),
            );
          },
        ),
      );
      final result = await OrderAddOnsRepository(dio)
          .decide(customerScope, 'extra', true, CancelToken());
      expect(result['totalAmount'], 178007);
      expect(result['commissionAmount'], 24009);
    },
  );
  test(
    'withdrawal uses the provider-scoped endpoint and no price body',
    () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(
              options.path,
              '/me/provider/orders/order/add-ons/extra/cancel',
            );
            expect(options.data, isNull);
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'success': true,
                  'data': addOnJson(status: 'CANCELLED'),
                },
              ),
            );
          },
        ),
      );
      expect(
        (await OrderAddOnsRepository(
          dio,
        ).withdraw(providerScope, 'extra', CancelToken())).status,
        'CANCELLED',
      );
    },
  );
  test(
    'missing/invalid monetary values fail rather than calculating a substitute',
    () {
      expect(
        () => AddOnOrder.fromJson({...orderJson(), 'totalAmount': null}),
        throwsFormatException,
      );
      expect(
        () => AddOnOption.fromJson({...optionJson(), 'priceAmount': -1}),
        throwsFormatException,
      );
      expect(
        () => OrderAddOn.fromJson({...addOnJson(), 'commissionAmount': '6000'}),
        throwsFormatException,
      );
    },
  );
  test(
    'failed options API surfaces error instead of returning an empty catalog',
    () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) => handler.reject(requestFailure()),
        ),
      );
      await expectLater(
        OrderAddOnsRepository(dio).options(providerScope, CancelToken()),
        throwsA(isA<DioException>()),
      );
    },
  );
}
