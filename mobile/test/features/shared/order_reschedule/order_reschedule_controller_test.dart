import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_reschedule/application/order_reschedule_controller.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';

import 'support/reschedule_fakes.dart';

void main() {
  test(
    'customer proposal leaves the current confirmed time unchanged',
    () async {
      final repo = FakeRescheduleRepository();
      final controller = OrderRescheduleController(
        repo,
        customerScope,
        safetyBlocked: () => false,
        clock: () => now,
      );
      addTearDown(controller.dispose);
      final oldTime = repo.current.startAt;
      expect(
        await controller.request(now.add(const Duration(hours: 4))),
        isTrue,
      );
      expect(controller.state.order?.startAt, oldTime);
      expect(controller.state.order?.proposal?.status, 'PENDING');
      expect(repo.requests, 1);
    },
  );
  for (final approve in [false, true]) {
    test(
      'provider ${approve ? 'approval' : 'rejection'} uses the visible proposal and refreshes the order',
      () async {
        final repo = FakeRescheduleRepository()
          ..current = order(request: proposal());
        final controller = OrderRescheduleController(
          repo,
          providerScope,
          safetyBlocked: () => false,
          clock: () => now,
        );
        addTearDown(controller.dispose);
        expect(await controller.decide(proposal(), approve), isTrue);
        expect(
          controller.state.order?.proposal?.status,
          approve ? 'ACCEPTED' : 'REJECTED',
        );
        expect(
          controller.state.order?.startAt,
          now.add(Duration(hours: approve ? 4 : 2)),
        );
      },
    );
  }
  test(
    'blocks requests outside time window and the same existing time',
    () async {
      final repo = FakeRescheduleRepository();
      final controller = OrderRescheduleController(
        repo,
        customerScope,
        safetyBlocked: () => false,
        clock: () => now,
      );
      addTearDown(controller.dispose);
      for (final time in [
        now.add(const Duration(minutes: 59)),
        now.add(const Duration(days: 31)),
        repo.current.startAt!,
      ]) {
        expect(await controller.request(time), isFalse);
      }
      expect(repo.requests, 0);
    },
  );
  test('ASAP, EN_ROUTE and SAFETY_HOLD cannot request rescheduling', () async {
    final repo = FakeRescheduleRepository();
    final controller = OrderRescheduleController(
      repo,
      customerScope,
      safetyBlocked: () => false,
      clock: () => now,
    );
    addTearDown(controller.dispose);
    for (final data in [
      order(type: 'ASAP'),
      order(status: 'EN_ROUTE'),
      order(status: 'SAFETY_HOLD'),
    ]) {
      repo.current = data;
      expect(
        await controller.request(now.add(const Duration(hours: 4))),
        isFalse,
      );
    }
    expect(repo.requests, 0);
  });
  test('rechecks safety hold after the preflight GET', () async {
    var held = false;
    final repo = FakeRescheduleRepository()
      ..onRead = () async {
        held = true;
        return order();
      };
    final controller = OrderRescheduleController(
      repo,
      customerScope,
      safetyBlocked: () => held,
      clock: () => now,
    );
    addTearDown(controller.dispose);
    expect(
      await controller.request(now.add(const Duration(hours: 4))),
      isFalse,
    );
    expect(repo.requests, 0);
  });
  test('does not decide an expired or replaced request', () async {
    final repo = FakeRescheduleRepository()
      ..current = order(request: proposal(id: 'newer'));
    final controller = OrderRescheduleController(
      repo,
      providerScope,
      safetyBlocked: () => false,
      clock: () => now,
    );
    addTearDown(controller.dispose);
    expect(await controller.decide(proposal(), true), isFalse);
    repo.current = order(request: proposal(expires: now));
    expect(await controller.decide(proposal(), true), isFalse);
    expect(repo.decisions, 0);
  });
  test('conflict refetches the order and keeps the original time', () async {
    final repo = FakeRescheduleRepository()
      ..onRequest = (_) async => throw failure(status: 409);
    final controller = OrderRescheduleController(
      repo,
      customerScope,
      safetyBlocked: () => false,
      clock: () => now,
    );
    addTearDown(controller.dispose);
    expect(
      await controller.request(now.add(const Duration(hours: 4))),
      isFalse,
    );
    expect(repo.reads, 2);
    expect(controller.state.order?.startAt, now.add(const Duration(hours: 2)));
    expect(controller.state.error, contains('trùng'));
  });
  test(
    'timeout reconciles a committed request without retrying POST',
    () async {
      final repo = FakeRescheduleRepository();
      repo.onRequest = (time) async {
        repo.current = order(request: proposal(start: time));
        throw failure();
      };
      final controller = OrderRescheduleController(
        repo,
        customerScope,
        safetyBlocked: () => false,
        clock: () => now,
      );
      addTearDown(controller.dispose);
      expect(
        await controller.request(now.add(const Duration(hours: 4))),
        isTrue,
      );
      expect(repo.requests, 1);
      expect(controller.state.needsRefresh, isFalse);
    },
  );
  test(
    'unknown result disables retry until a successful manual refresh',
    () async {
      final repo = FakeRescheduleRepository();
      repo.onRequest = (_) async {
        repo.onRead = () async => throw failure();
        throw failure();
      };
      final controller = OrderRescheduleController(
        repo,
        customerScope,
        safetyBlocked: () => false,
        clock: () => now,
      );
      addTearDown(controller.dispose);
      expect(
        await controller.request(now.add(const Duration(hours: 4))),
        isFalse,
      );
      expect(controller.state.needsRefresh, isTrue);
      await controller.request(now.add(const Duration(hours: 4)));
      expect(repo.requests, 1);
      repo.onRead = null;
      await controller.refresh();
      expect(controller.state.needsRefresh, isFalse);
    },
  );
  test(
    'suppresses double submission and cancels in-flight work on disposal',
    () async {
      final repo = FakeRescheduleRepository();
      final gate = Completer<RescheduleProposal>();
      repo.onRequest = (_) => gate.future;
      final controller = OrderRescheduleController(
        repo,
        customerScope,
        safetyBlocked: () => false,
        clock: () => now,
      );
      final pending = controller.request(now.add(const Duration(hours: 4)));
      await Future<void>.delayed(Duration.zero);
      expect(
        await controller.request(now.add(const Duration(hours: 4))),
        isFalse,
      );
      expect(repo.requests, 1);
      controller.dispose();
      expect(controller.cancel.isCancelled, isTrue);
      gate.complete(proposal());
      await pending;
    },
  );
  test(
    'does not confirm a prior rejected request with the same proposed time',
    () async {
      final repo = FakeRescheduleRepository()
        ..current = order(
          request: proposal(id: 'old', status: 'REJECTED'),
        );
      repo.onRequest = (_) async => throw failure();
      final controller = OrderRescheduleController(
        repo,
        customerScope,
        safetyBlocked: () => false,
        clock: () => now,
      );
      addTearDown(controller.dispose);
      expect(
        await controller.request(now.add(const Duration(hours: 4))),
        isFalse,
      );
      expect(controller.state.error, isNotNull);
    },
  );
}
