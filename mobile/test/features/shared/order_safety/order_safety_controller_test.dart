import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import 'support/order_safety_fakes.dart';

void main() {
  late FakeSafetyRepository repo;
  late OrderSafetyController controller;
  setUp(() {
    repo = FakeSafetyRepository();
    controller = OrderSafetyController(repo, scope);
  });
  tearDown(() {
    if (controller.mounted) controller.dispose();
  });

  test(
    'SOS blocks immediately, suppresses double taps and confirms own report',
    () async {
      final gate = Completer<SafetyIncident>();
      repo.onRaise = () => gate.future;
      final pending = controller.raise();
      expect(controller.state.blocksOrder, isTrue);
      await controller.raise();
      expect(repo.posts, 1);
      gate.complete(own);
      await pending;
      expect(controller.state.incident?.ownReport, isTrue);
      expect(controller.state.submitting, isFalse);
      await controller.raise();
      expect(repo.posts, 1);
    },
  );

  test(
    'timeout reconciles successful server commit without another POST',
    () async {
      repo.onRaise = () async => throw offline();
      await controller.raise();
      expect(repo.gets, 1);
      expect(controller.state.incident?.ownReport, isTrue);
      expect(controller.state.uncertain, isFalse);
      await controller.raise();
      expect(repo.posts, 1);
    },
  );

  test(
    'timeout and failed reconciliation remain blocked; retry GET precedes POST',
    () async {
      repo.onRaise = () async => throw offline();
      repo.onMine = () async => throw offline();
      await controller.raise();
      expect(controller.state.uncertain, isTrue);
      expect(controller.state.blocksOrder, isTrue);
      repo.onMine = () async => own;
      await controller.raise();
      expect(repo.posts, 1);
      expect(controller.state.uncertain, isFalse);
    },
  );

  test('other party report does not count as my successful SOS', () async {
    repo.onRaise = () async => throw offline();
    repo.onMine = () async => other;
    await controller.raise();
    expect(controller.state.incident?.ownReport, isFalse);
    expect(controller.state.uncertain, isTrue);
    repo.onRaise = () async => own;
    final gate = Completer<SafetyIncident>();
    repo.onRaise = () => gate.future;
    final retry = controller.raise();
    await Future<void>.delayed(Duration.zero);
    await controller.raise();
    expect(repo.posts, 2);
    gate.complete(own);
    await retry;
    expect(controller.state.incident?.ownReport, isTrue);
  });

  test('definite rejection does not pretend that SOS succeeded', () async {
    repo.onRaise = () async => throw rejected();
    await controller.raise();
    expect(controller.state.incident, isNull);
    expect(controller.state.blocksOrder, isFalse);
    expect(controller.state.error, isNotNull);
    expect(repo.gets, 0);
  });

  test(
    'malformed acknowledgement is reconciled as an ambiguous commit',
    () async {
      repo.onRaise = () async => throw const FormatException('bad payload');
      await controller.raise();
      expect(repo.gets, 1);
      expect(controller.state.incident?.ownReport, isTrue);
    },
  );

  test(
    'refresh failure retains safety hold, CLOSED releases local hold',
    () async {
      await controller.raise();
      repo.onMine = () async => throw offline();
      await controller.refresh();
      expect(controller.state.blocksOrder, isTrue);
      repo.onMine = () async => closed;
      await controller.refresh();
      expect(controller.state.blocksOrder, isFalse);
    },
  );

  test('background refresh alone does not block an ordinary order', () async {
    final gate = Completer<SafetyIncident>();
    repo.onMine = () => gate.future;
    final refresh = controller.refresh();
    expect(controller.state.busy, isTrue);
    expect(controller.state.blocksOrder, isFalse);
    gate.complete(closed);
    await refresh;
  });

  test('evidence requires my OPEN report and stops at five images', () async {
    final file = XFile('unused');
    await controller.upload(file);
    expect(repo.uploads, 0);
    repo.onMine = () async => other;
    await controller.refresh();
    await controller.upload(file);
    expect(repo.uploads, 0);
    repo.onMine = () async => const SafetyIncident(
      id: 'incident',
      status: 'OPEN',
      ownReport: true,
      evidenceIds: ['1', '2', '3', '4', '5'],
    );
    await controller.refresh();
    await controller.upload(file);
    expect(repo.uploads, 0);
    repo.onMine = () async => own;
    await controller.refresh();
    await controller.upload(file);
    expect(repo.uploads, 1);
    repo.onMine = () async => closed;
    await controller.refresh();
    await controller.upload(file);
    expect(repo.uploads, 1);
  });

  test(
    'dispose cancels outstanding request and ignores late acknowledgement',
    () async {
      final gate = Completer<SafetyIncident>();
      repo.onRaise = () => gate.future;
      final pending = controller.raise();
      controller.dispose();
      expect(controller.cancel.isCancelled, isTrue);
      gate.complete(own);
      await pending;
    },
  );
}
