import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/payment_dispute/application/payment_dispute_controller.dart';

import 'support/payment_dispute_fakes.dart';

void main() {
  late FakeDisputeRepository repo;
  PaymentDisputeController controller({
    bool Function()? safety,
    bool customer = false,
  }) {
    final value = PaymentDisputeController(
      repo,
      customer ? customerScope : providerScope,
      safetyBlocked: safety ?? () => false,
    );
    addTearDown(value.dispose);
    return value;
  }

  setUp(() => repo = FakeDisputeRepository());
  test(
    'reports unpaid without completion and uses actual held commission',
    () async {
      final value = controller();
      final result = await value.open('  $reason  ');
      expect(result?['status'], 'PAYMENT_DISPUTE');
      expect(repo.sentReason, reason);
      expect(value.state.order?.hold?.amount, 30000);
      expect(value.state.order?.hold?.status, 'ACTIVE');
      expect(value.state.busy, isFalse);
    },
  );
  test('requires provider and 10-500 trimmed characters', () async {
    await controller(customer: true).open(reason);
    final value = controller();
    for (final input in ['', '   a   ', 'a' * 501]) {
      await value.open(input);
    }
    expect(repo.reads + repo.posts, 0);
  });
  test('fresh order, evidence, hold and cancellation gate the write', () async {
    final value = controller();
    for (final json in [
      {...orderJson(), 'status': 'EN_ROUTE'},
      {...orderJson(), 'evidence': []},
      {...orderJson(), 'commissionHold': null},
      {
        ...orderJson(),
        'commissionHold': {'amount': 30000, 'status': 'RELEASED'},
      },
      {
        ...orderJson(),
        'cancellationRequest': {'status': 'PENDING_CUSTOMER'},
      },
      {
        ...orderJson(),
        'cancellationRequest': {'status': 'SUPPORT_REVIEW'},
      },
    ]) {
      repo.current = json;
      expect(await value.open(reason), isNull);
    }
    expect(repo.posts, 0);
  });
  test('rechecks SOS after preflight', () async {
    var safety = false;
    final value = controller(safety: () => safety);
    repo.onRead = () async {
      safety = true;
      return orderJson();
    };
    await value.open(reason);
    expect(repo.posts, 0);
  });
  test('duplicate taps cannot send concurrent reports', () async {
    final value = controller();
    final gate = Completer<Map<String, dynamic>>();
    repo.onOpen = () => gate.future;
    final first = value.open(reason);
    await Future<void>.delayed(Duration.zero);
    expect(value.state.blocksActions, isTrue);
    expect(await value.open(reason), isNull);
    gate.complete(orderJson(status: 'PAYMENT_DISPUTE'));
    await first;
    expect(repo.posts, 1);
  });
  test('timeout after commit reconciles without replaying POST', () async {
    final value = controller();
    repo.onOpen = () async {
      repo.current = orderJson(status: 'PAYMENT_DISPUTE');
      throw timeout();
    };
    expect((await value.open(reason))?['status'], 'PAYMENT_DISPUTE');
    await value.open(reason);
    expect(repo.posts, 1);
  });
  test(
    'unknown write blocks further actions until explicit read succeeds',
    () async {
      final value = controller();
      repo.onOpen = () async {
        repo.onRead = () async => throw timeout();
        throw timeout();
      };
      await value.open(reason);
      expect(value.state.uncertain, isTrue);
      await value.open(reason);
      await value.refresh();
      expect(value.state.blocksActions, isTrue);
      expect(repo.posts, 1);
      repo.onRead = null;
      repo.current = orderJson(status: 'DISPUTED');
      await value.refresh();
      expect(value.state.uncertain, isFalse);
      expect(value.state.order?.status, 'DISPUTED');
    },
  );
  test('timeout with an unchanged reconciliation read still requires manual refresh', () async {
    final value = controller();
    repo.onOpen = () async => throw timeout();
    await value.open(reason);
    expect(value.state.uncertain, isTrue);
    expect(repo.posts, 1);
  });
  for (final status in ['PAYMENT_DISPUTE', 'DISPUTED', 'COMPLETED']) {
    test('existing $status is never reopened', () async {
      repo.current = orderJson(status: status);
      final result = await controller().open(reason);
      expect(result?['status'], status);
      expect(repo.posts, 0);
    });
  }
  test('disposing during preflight cancels future work', () async {
    final gate = Completer<Map<String, dynamic>>();
    repo.onRead = () => gate.future;
    final value = PaymentDisputeController(
      repo,
      providerScope,
      safetyBlocked: () => false,
    );
    final result = value.open(reason);
    value.dispose();
    gate.complete(orderJson());
    expect(await result, isNull);
    expect(value.cancel.isCancelled, isTrue);
    expect(repo.posts, 0);
  });
}
