import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/domain/repositories/customer_orders_repository.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';

void main() {
  for (final localHold in [false, true]) {
    test(
      'blocks customer mutations during ${localHold ? 'local SOS' : 'server SAFETY_HOLD'}',
      () async {
        final repository = _DeferredOrdersRepository();
        final response = Completer<CustomerOrderEntity>();
        repository.responses.add(response);
        final notifier = CustomerOrderDetailNotifier(
          repository,
          'order-1',
          isSafetyBlocked: () => localHold,
        );
        addTearDown(notifier.dispose);
        response.complete(_order(localHold ? 'ACCEPTED' : 'SAFETY_HOLD'));
        await Future<void>.delayed(Duration.zero);
        expect(await notifier.cancelOrder('reason'), isFalse);
        expect(await notifier.decideCancellation(approve: true), isFalse);
        expect(await notifier.submitReview(rating: 5), isFalse);
        expect(notifier.state.errorMessage, contains('an toàn'));
        expect(notifier.state.order!.shouldPoll, isTrue);
      },
    );
  }
  test(
    'silent refresh retains the previous order until the API responds',
    () async {
      final repository = _DeferredOrdersRepository();
      final firstResponse = Completer<CustomerOrderEntity>();
      repository.responses.add(firstResponse);
      final notifier = CustomerOrderDetailNotifier(repository, 'order-1');
      addTearDown(notifier.dispose);

      firstResponse.complete(_order('PENDING_PROVIDER'));
      await Future<void>.delayed(Duration.zero);
      expect(notifier.state.order?.status, 'PENDING_PROVIDER');

      final nextResponse = Completer<CustomerOrderEntity>();
      repository.responses.add(nextResponse);
      final refresh = notifier.fetchOrder(silent: true);
      expect(notifier.state.order?.status, 'PENDING_PROVIDER');
      expect(notifier.state.isLoading, isFalse);

      nextResponse.complete(_order('ACCEPTED'));
      await refresh;
      expect(notifier.state.order?.status, 'ACCEPTED');
    },
  );

  test(
    'event refresh arriving during a request is fetched afterwards',
    () async {
      final repository = _DeferredOrdersRepository();
      final initial = Completer<CustomerOrderEntity>();
      repository.responses.add(initial);
      final notifier = CustomerOrderDetailNotifier(repository, 'order-1');
      addTearDown(notifier.dispose);
      initial.complete(_order('PENDING_PROVIDER'));
      await Future<void>.delayed(Duration.zero);

      final inFlight = Completer<CustomerOrderEntity>();
      final afterEvent = Completer<CustomerOrderEntity>();
      repository.responses.addAll([inFlight, afterEvent]);
      final refresh = notifier.fetchOrder(silent: true);
      await notifier.fetchOrder(silent: true, queueIfBusy: true);
      inFlight.complete(_order('ACCEPTED'));
      await refresh;
      await Future<void>.delayed(Duration.zero);
      expect(repository.responses, isEmpty);

      afterEvent.complete(_order('EN_ROUTE'));
      await Future<void>.delayed(Duration.zero);
      expect(notifier.state.order?.status, 'EN_ROUTE');
    },
  );

  test('queued refresh waits while hidden and runs once on return', () async {
    final repository = _DeferredOrdersRepository();
    final initial = Completer<CustomerOrderEntity>();
    repository.responses.add(initial);
    final notifier = CustomerOrderDetailNotifier(repository, 'order-1');
    addTearDown(notifier.dispose);
    initial.complete(_order('PENDING_PROVIDER'));
    await Future<void>.delayed(Duration.zero);

    final inFlight = Completer<CustomerOrderEntity>();
    final onReturn = Completer<CustomerOrderEntity>();
    repository.responses.addAll([inFlight, onReturn]);
    final refresh = notifier.fetchOrder(silent: true);
    await notifier.fetchOrder(silent: true, queueIfBusy: true);
    notifier.pausePolling();
    inFlight.complete(_order('ACCEPTED'));
    await refresh;
    expect(repository.responses, hasLength(1));

    notifier.resumePolling();
    expect(repository.responses, isEmpty);
    onReturn.complete(_order('EN_ROUTE'));
    await Future<void>.delayed(Duration.zero);
    expect(notifier.state.order?.status, 'EN_ROUTE');
  });
}

CustomerOrderEntity _order(String status) => CustomerOrderEntity(
  id: 'order-1',
  bookingType: 'ASAP',
  status: status,
  serviceName: 'Cắt tóc',
  servicePriceAmount: 120000,
  totalAmount: 120000,
);

class _DeferredOrdersRepository implements CustomerOrdersRepository {
  final responses = <Completer<CustomerOrderEntity>>[];

  @override
  Future<CustomerOrderEntity> getMyOrderById(String orderId) =>
      responses.removeAt(0).future;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
