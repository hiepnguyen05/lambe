import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_add_ons/application/order_add_ons_controller.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';

import 'support/add_on_fakes.dart';

void main() {
  late FakeAddOnsRepository repo;
  OrderAddOnsController controller(AddOnScope scope, {bool Function()? held}) {
    final value = OrderAddOnsController(
      repo,
      scope,
      safetyBlocked: held ?? () => false,
      clock: () => now,
    );
    addTearDown(() {
      if (value.mounted) value.dispose();
    });
    return value;
  }

  setUp(() => repo = FakeAddOnsRepository());
  test('proposal normalizes note, creates only a pending row and keeps original totals', () async {
    final value = controller(providerScope);
    expect((await value.propose(option(), '  Màu nâu  ')).success, isTrue);
    expect(repo.sentNote, 'Màu nâu');
    expect(value.state.order?.totalAmount, 138000);
    expect(value.state.order?.items.single.status, 'PENDING');
    expect(repo.keys.single, matches(RegExp(r'^[a-zA-Z0-9_-]{8,128}$')));
  });
  test(
    'retry preserves the same idempotency key and body after timeout',
    () async {
      final value = controller(providerScope);
      repo.onPropose = () async => throw requestFailure();
      expect((await value.propose(option(), ' Màu nâu ')).success, isFalse);
      repo.onPropose = null;
      expect((await value.propose(option(), 'Màu nâu')).success, isTrue);
      expect(repo.keys[0], repo.keys[1]);
      expect(repo.proposals, 2);
    },
  );
  test(
    'a changed draft uses a new key, never reusing a key for different content',
    () async {
      final value = controller(providerScope);
      repo.onPropose = () async => throw requestFailure();
      await value.propose(option(), 'nâu');
      await value.propose(option(), 'đen');
      expect(repo.keys[0], isNot(repo.keys[1]));
    },
  );
  test('a resolved proposal followed by rejection starts a new intent with a new key', () async {
    final value = controller(providerScope);
    repo.onPropose = () async {
      repo.current = orderJson(items: [addOnJson()]);
      throw requestFailure();
    };
    await value.propose(option(), 'Màu nâu');
    repo.current = orderJson(items: [addOnJson(status: 'REJECTED')]);
    repo.onPropose = null;
    expect((await value.propose(option(), 'Màu nâu')).success, isTrue);
    expect(repo.keys[0], isNot(repo.keys[1]));
  });
  test('read failure after uncertain POST blocks retry until manual reconciliation', () async {
    final value = controller(providerScope);
    repo.onPropose = () async {
      repo.onRead = () async => throw requestFailure();
      throw requestFailure();
    };
    await value.propose(option(), '');
    expect(value.state.needsRefresh, isTrue);
    await value.propose(option(), '');
    expect(repo.proposals, 1);
    repo.onRead = null;
    await value.refresh();
    expect(value.state.needsRefresh, isFalse);
  });
  test(
    'timeout after commit reloads pending row without a second POST',
    () async {
      final value = controller(providerScope);
      repo.onPropose = () async {
        repo.current = orderJson(items: [addOnJson()]);
        throw requestFailure();
      };
      await value.propose(option(), '');
      expect(value.state.order?.items.single.status, 'PENDING');
      await value.propose(option(), '');
      expect(repo.proposals, 1);
    },
  );
  for (final approve in [false, true]) {
    test(
      'customer ${approve ? 'approval' : 'rejection'} uses exact server order and returns raw snapshot',
      () async {
        repo.current = orderJson(items: [addOnJson()]);
        final value = controller(customerScope);
        final outcome = await value.decide(item(), approve);
        expect(outcome.success, isTrue);
        expect(outcome.orderJson?['totalAmount'], approve ? 178000 : 138000);
        expect(value.state.order?.commissionAmount, approve ? 24000 : 18000);
        expect(value.state.order?.durationMinutes, approve ? 80 : 60);
      },
    );
  }
  test(
    'withdrawal keeps original totals and marks the request cancelled',
    () async {
      repo.current = orderJson(items: [addOnJson()]);
      final value = controller(providerScope);
      expect((await value.withdraw(item())).success, isTrue);
      expect(value.state.order?.totalAmount, 138000);
      expect(value.state.order?.items.single.status, 'CANCELLED');
    },
  );
  test('fresh availability and price changes prevent proposal POST', () async {
    final value = controller(providerScope);
    repo.available = [option(available: false)];
    expect((await value.propose(option(), '')).success, isFalse);
    repo.available = [option(price: 90000)];
    expect((await value.propose(option(), '')).success, isFalse);
    expect(repo.proposals, 0);
  });
  test('blocks wrong order states, cancellation, existing pending and accepted cap', () async {
    final value = controller(providerScope);
    final examples = [
      orderJson(status: 'EN_ROUTE'),
      orderJson(status: 'SAFETY_HOLD'),
      orderJson(cancellation: 'PENDING_CUSTOMER'),
      orderJson(items: [addOnJson()]),
      orderJson(
        items: List.generate(
          5,
          (i) => addOnJson(id: 'accepted-$i', status: 'ACCEPTED'),
        ),
      ),
    ];
    for (final json in examples) {
      repo.current = json;
      expect((await value.propose(option(), '')).success, isFalse);
    }
    expect(repo.proposals, 0);
  });
  test('role checks, expired request, changed terms and oversized notes never mutate', () async {
    final customer = controller(customerScope);
    final provider = controller(providerScope);
    await customer.propose(option(), '');
    repo.current = orderJson(items: [addOnJson(expires: now)]);
    await customer.decide(item(), true);
    await provider.decide(item(), true);
    repo.current = orderJson(
      items: [
        {...addOnJson(), 'priceAmount': 60000},
      ],
    );
    await customer.decide(item(), true);
    await provider.propose(option(), 'a' * 501);
    expect(repo.proposals + repo.decisions + repo.withdrawals, 0);
  });
  test('rechecks SOS after the preflight order GET', () async {
    var held = false;
    final value = controller(providerScope, held: () => held);
    repo.onRead = () async {
      held = true;
      return AddOnOrder.fromJson(orderJson());
    };
    await value.propose(option(), '');
    expect(repo.proposals, 0);
  });
  test(
    '409 refetches changed state and never retries or applies a guessed total',
    () async {
      repo.current = orderJson(items: [addOnJson()]);
      repo.onDecide = (_) async => throw requestFailure(status: 409);
      final value = controller(customerScope);
      expect((await value.decide(item(), true)).success, isFalse);
      expect(repo.decisions, 1);
      expect(repo.reads, 2);
      expect(value.state.order?.totalAmount, 138000);
    },
  );
  test(
    'double submission is ignored; disposal cancels the pending request',
    () async {
      final value = controller(providerScope);
      final gate = Completer<OrderAddOn>();
      repo.onPropose = () => gate.future;
      final pending = value.propose(option(), '');
      await Future<void>.delayed(Duration.zero);
      await value.propose(option(), '');
      expect(repo.proposals, 1);
      value.dispose();
      expect(value.cancel.isCancelled, isTrue);
      gate.complete(item());
      await pending;
    },
  );
}
