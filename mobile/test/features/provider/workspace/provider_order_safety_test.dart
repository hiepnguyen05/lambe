import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/data/datasources/provider_orders_remote_datasource.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/provider/location/application/provider_location_coordinator.dart';
import 'package:mobile/features/shared/payment_dispute/application/payment_dispute_controller.dart';

import '../../shared/payment_dispute/support/payment_dispute_fakes.dart'
    as payment;

import '../../shared/order_safety/support/order_safety_fakes.dart'
    show FakeSafetyRepository, own;

class _Orders extends ProviderOrdersRemoteDataSource {
  String status = 'EN_ROUTE';
  Map<String, dynamic> extra = {};
  int completions = 0;
  @override
  Future<Map<String, dynamic>> getProviderOrderDetail(String orderId) async => {
    'id': orderId,
    'status': status,
    ...extra,
  };
  @override
  Future<Map<String, dynamic>> completeOrder(
    String id, {
    required bool cashReceived,
  }) async {
    completions++;
    return {'id': id, 'status': 'COMPLETED'};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Publisher extends ProviderLocationCoordinator {
  int starts = 0;
  int stops = 0;
  _Publisher()
    : super(
        locate: (_) => Future.error(StateError('Unexpected GPS capture')),
        positions: (_) => const Stream.empty(),
        heartbeat: (_, _) async {},
        availability: (_) async => false,
        send: (_, _, _) async => null,
        getOrder: (_, _) async => {},
      );
  @override
  Future<void> start(String orderId) async {
    starts++;
  }

  @override
  Future<void> stop({String? onlyOrderId}) async {
    stops++;
  }
}

void main() {
  for (final status in ['PAYMENT_DISPUTE', 'DISPUTED']) {
    test(
      '$status blocks ordinary execution actions and cash confirmation',
      () async {
        final orders = _Orders()..status = status;
        final container = ProviderContainer(
          overrides: [
            orderSafetyProvider.overrideWith(
              (ref, scope) =>
                  OrderSafetyController(FakeSafetyRepository(), scope),
            ),
            providerOrdersRemoteDataSourceProvider.overrideWithValue(orders),
            providerLocationCoordinatorProvider.overrideWith(
              (ref) => _Publisher(),
            ),
          ],
        );
        addTearDown(container.dispose);
        final subscription = container.listen(
          providerOrderExecutionNotifierProvider('order'),
          (_, _) {},
        );
        addTearDown(subscription.close);
        final notifier = container.read(
          providerOrderExecutionNotifierProvider('order').notifier,
        );
        await Future<void>.delayed(Duration.zero);
        notifier.setCashReceivedChecked(true);
        expect(notifier.state.cashReceivedChecked, isFalse);
        expect(await notifier.completeOrder(cashReceived: true), isFalse);
        expect(await notifier.openPaymentDispute(payment.reason), isFalse);
        expect(orders.completions, 0);
      },
    );
  }
  for (final unknown in [false, true]) {
    test(
      'payment report ${unknown ? 'uncertainty survives polling' : 'immediately replaces the execution order'}',
      () async {
        final repo = payment.FakeDisputeRepository();
        if (unknown) {
          repo.onOpen = () async {
            repo.onRead = () async => throw payment.timeout();
            throw payment.timeout();
          };
        }
        final orders = _Orders()
          ..status = 'IN_PROGRESS'
          ..extra = payment.orderJson();
        final container = ProviderContainer(
          overrides: [
            orderSafetyProvider.overrideWith(
              (ref, scope) =>
                  OrderSafetyController(FakeSafetyRepository(), scope),
            ),
            providerOrdersRemoteDataSourceProvider.overrideWithValue(orders),
            providerLocationCoordinatorProvider.overrideWith(
              (ref) => _Publisher(),
            ),
            paymentDisputeProvider.overrideWith(
              (ref, scope) => PaymentDisputeController(
                repo,
                scope,
                safetyBlocked: () => false,
              ),
            ),
          ],
        );
        addTearDown(container.dispose);
        final subscription = container.listen(
          providerOrderExecutionNotifierProvider('order'),
          (_, _) {},
        );
        addTearDown(subscription.close);
        final paymentSubscription = container.listen(
          paymentDisputeProvider(payment.providerScope),
          (_, _) {},
        );
        addTearDown(paymentSubscription.close);
        final notifier = container.read(
          providerOrderExecutionNotifierProvider('order').notifier,
        );
        await Future<void>.delayed(Duration.zero);
        notifier.setCashReceivedChecked(true);
        expect(await notifier.openPaymentDispute(payment.reason), !unknown);
        await notifier.fetchDetail(silent: true);
        expect(
          notifier.state.status,
          unknown ? 'IN_PROGRESS' : 'PAYMENT_DISPUTE',
        );
        expect(notifier.state.cashReceivedChecked, isFalse);
        expect(await notifier.completeOrder(cashReceived: true), isFalse);
        expect(orders.completions, 0);
        expect(repo.posts, 1);
      },
    );
  }
  test('pending add-on blocks completion and changed total clears cash confirmation', () async {
    final orders = _Orders()
      ..status = 'IN_PROGRESS'
      ..extra = {
        'totalAmount': 138000,
        'addOns': [
          {
            'status': 'PENDING',
            'expiresAt': DateTime.now()
                .add(const Duration(minutes: 10))
                .toUtc()
                .toIso8601String(),
          },
        ],
      };
    final container = ProviderContainer(
      overrides: [
        orderSafetyProvider.overrideWith(
          (ref, scope) => OrderSafetyController(FakeSafetyRepository(), scope),
        ),
        providerOrdersRemoteDataSourceProvider.overrideWithValue(orders),
        providerLocationCoordinatorProvider.overrideWith((ref) => _Publisher()),
      ],
    );
    addTearDown(container.dispose);
    final listener = container.listen(
      providerOrderExecutionNotifierProvider('order'),
      (_, _) {},
    );
    addTearDown(listener.close);
    final notifier = container.read(
      providerOrderExecutionNotifierProvider('order').notifier,
    );
    await Future<void>.delayed(Duration.zero);
    notifier.setCashReceivedChecked(true);
    expect(await notifier.completeOrder(cashReceived: true), isFalse);
    expect(orders.completions, 0);
    orders.extra = {'totalAmount': 178000, 'addOns': []};
    await notifier.fetchDetail(silent: true);
    expect(notifier.state.cashReceivedChecked, isFalse);
    expect(notifier.addOnsBlockCompletion, isFalse);
  });
  test('local SOS stops tracking and prevents actions and stale-response GPS restart', () async {
    final repo = FakeSafetyRepository();
    final safety = OrderSafetyController(
      repo,
      const SafetyScope('order', SafetyRole.provider),
    );
    final publisher = _Publisher();
    final orders = _Orders();
    final container = ProviderContainer(
      overrides: [
        orderSafetyProvider.overrideWith((ref, scope) => safety),
        providerOrdersRemoteDataSourceProvider.overrideWithValue(orders),
        providerLocationCoordinatorProvider.overrideWith((ref) => publisher),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      providerOrderExecutionNotifierProvider('order'),
      (_, _) {},
    );
    addTearDown(subscription.close);
    final notifier = container.read(
      providerOrderExecutionNotifierProvider('order').notifier,
    );
    await Future<void>.delayed(Duration.zero);
    expect(publisher.starts, 1);
    final gate = Completer<SafetyIncident>();
    repo.onRaise = () => gate.future;
    final sos = safety.raise();
    expect(publisher.stops, greaterThanOrEqualTo(1));
    var mutations = 0;
    expect(
      await notifier.handleAction(() async {
        mutations++;
      }),
      isFalse,
    );
    expect(mutations, 0);
    await notifier.fetchDetail(silent: true);
    expect(publisher.starts, 1);
    gate.complete(own);
    await sos;
    expect(await notifier.completeOrder(cashReceived: true), isFalse);
    expect(await notifier.requestCancellation(reason: 'OTHER'), isFalse);
  });

  test(
    'server SAFETY_HOLD rejects actions without invoking their callback',
    () async {
      final orders = _Orders()..status = 'SAFETY_HOLD';
      final container = ProviderContainer(
        overrides: [
          orderSafetyProvider.overrideWith(
            (ref, scope) =>
                OrderSafetyController(FakeSafetyRepository(), scope),
          ),
          providerOrdersRemoteDataSourceProvider.overrideWithValue(orders),
          providerLocationCoordinatorProvider.overrideWith(
            (ref) => _Publisher(),
          ),
        ],
      );
      addTearDown(container.dispose);
      final subscription = container.listen(
        providerOrderExecutionNotifierProvider('order'),
        (_, _) {},
      );
      addTearDown(subscription.close);
      final notifier = container.read(
        providerOrderExecutionNotifierProvider('order').notifier,
      );
      await Future<void>.delayed(Duration.zero);
      var calls = 0;
      expect(
        await notifier.handleAction(() async {
          calls++;
        }),
        isFalse,
      );
      expect(calls, 0);
    },
  );
}
