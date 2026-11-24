import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/shared/order_reschedule/data/order_reschedule_repository.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';

void main() {
  final request = <String, dynamic>{
    'id': 'request',
    'status': 'PENDING',
    'proposedStartAt': '2026-11-02T18:30:00+07:00',
    'proposedEndAt': '2026-11-02T19:30:00+07:00',
    'createdAt': '2026-11-02T08:00:00Z',
    'expiresAt': '2026-11-02T08:30:00Z',
  };
  test('Vietnam wall time converts to UTC regardless of device timezone', () {
    final time = fromVietnamWallTime(DateTime(2026, 11, 2), 18, 30);
    expect(time, DateTime.utc(2026, 11, 2, 11, 30));
    expect(vietnamWallTime(time).hour, 18);
    expect(RescheduleProposal.fromJson(request).startAt, time);
    expect(() => instant('2026-11-02T18:30:00'), throwsFormatException);
  });
  test('time window accepts exactly 60 minutes and 30 days, rejecting just outside', () {
    final now = DateTime.utc(2026, 11, 2);
    expect(
      validateRescheduleTime(now.add(const Duration(hours: 1)), now, null),
      isNull,
    );
    expect(
      validateRescheduleTime(now.add(const Duration(days: 30)), now, null),
      isNull,
    );
    expect(
      validateRescheduleTime(
        now.add(const Duration(hours: 1) - Duration(seconds: 1)),
        now,
        null,
      ),
      isNotNull,
    );
    expect(
      validateRescheduleTime(
        now.add(const Duration(days: 30, seconds: 1)),
        now,
        null,
      ),
      isNotNull,
    );
  });
  test(
    'request POST sends UTC and decision POST is pinned to requestId',
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
                data: {'success': true, 'data': request},
              ),
            );
          },
        ),
      );
      final repo = OrderRescheduleRepository(dio);
      await repo.request(
        const RescheduleScope('order', RescheduleRole.customer),
        fromVietnamWallTime(DateTime(2026, 11, 2), 18, 30),
        CancelToken(),
      );
      expect(requests[0].path, '/me/orders/order/reschedule');
      expect(requests[0].data, {'scheduledAt': '2026-11-02T11:30:00.000Z'});
      await repo.decide(
        const RescheduleScope('order', RescheduleRole.provider),
        'request',
        true,
        CancelToken(),
      );
      expect(requests[1].path, '/me/provider/orders/order/reschedule/decision');
      expect(requests[1].data, {'requestId': 'request', 'approve': true});
    },
  );
  test('GET reconciliation uses role-scoped order detail without an invented endpoint', () async {
    for (final role in RescheduleRole.values) {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(
              options.path,
              role == RescheduleRole.customer
                  ? '/me/orders/order'
                  : '/me/provider/orders/order',
            );
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'success': true,
                  'data': {
                    'id': 'order',
                    'bookingType': 'SCHEDULED',
                    'status': 'ACCEPTED',
                    'scheduledAt': '2026-11-02T09:00:00Z',
                    'rescheduleRequest': request,
                  },
                },
              ),
            );
          },
        ),
      );
      expect(
        (await OrderRescheduleRepository(
          dio,
        ).read(RescheduleScope('order', role), CancelToken())).proposal?.id,
        'request',
      );
    }
  });
  test('customer model retains typed proposal and equality reflects decision updates', () {
    final json = <String, dynamic>{
      'id': 'order',
      'bookingType': 'SCHEDULED',
      'status': 'ACCEPTED',
      'scheduledAt': '2026-11-02T09:00:00Z',
      'rescheduleRequest': request,
    };
    final before = CustomerOrderEntity.fromJson(json);
    final after = CustomerOrderEntity.fromJson({
      ...json,
      'rescheduleRequest': {
        ...request,
        'status': 'REJECTED',
        'respondedAt': '2026-11-02T08:15:00Z',
      },
    });
    expect(before.rescheduleSnapshot.proposal?.id, 'request');
    expect(before, isNot(equals(after)));
    expect(after.scheduledAt, before.scheduledAt);
  });
}
