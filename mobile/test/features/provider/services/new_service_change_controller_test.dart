import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/application/new_service_change_controller.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';

import 'support/service_fakes.dart';

void main() {
  late FakeProviderServicesRepository repo;
  late NewServiceChangeController controller;
  setUp(() {
    repo = FakeProviderServicesRepository();
    controller = NewServiceChangeController(repo, changed: () {});
  });
  tearDown(() {
    if (controller.mounted) controller.dispose();
  });
  for (final type in ServiceChangeType.values) {
    test(
      'creates only one draft for ${type.wire}; sending remains a separate action',
      () async {
        repo.current = changeFromJson(changeJson(type: type));
        final result = await controller.create(
          draft(type: type),
          repo.definition,
        );
        expect(result?.status, ServiceChangeStatus.draft);
        expect(repo.creates, 1);
        expect(repo.submissions, 0);
        expect(
          await controller.create(draft(type: type), repo.definition),
          isNull,
        );
      },
    );
  }
  test(
    'fresh catalog price range blocks a previously valid price before POST',
    () async {
      final initial = repo.definition;
      repo.definition = definitionFromJson({
        ...definitionJson(),
        'minPriceAmount': 130000,
      });
      expect(
        await controller.create(
          draft(type: ServiceChangeType.addExisting),
          initial,
        ),
        isNull,
      );
      expect(repo.creates, 0);
    },
  );
  test('unknown creation never replays; recovery finds a matching existing open draft', () async {
    repo.onCreate = () async => throw failure();
    await controller.create(draft(), repo.definition);
    expect(controller.state.uncertain, isTrue);
    expect(await controller.create(draft(), repo.definition), isNull);
    expect((await controller.recover())?.id, 'request');
    expect(repo.creates, 1);
    expect(controller.state.uncertain, isFalse);
  });
  test('successful empty reconciliation allows a deliberate retry; failed read stays locked', () async {
    repo.onCreate = () async => throw failure();
    await controller.create(draft(), repo.definition);
    repo.onPage = (_, _) async => throw failure();
    await controller.recover();
    expect(controller.state.uncertain, isTrue);
    repo.onPage = (_, page) async => ServiceChangesPage([], page, 0);
    await controller.recover();
    expect(controller.state.uncertain, isFalse);
    expect(repo.creates, 1);
    repo.onCreate = null;
    expect(await controller.create(draft(), repo.definition), isNotNull);
    expect(repo.creates, 2);
  });
  test(
    'dispose while checking a target stops creation and cancels requests',
    () async {
      final gate = Completer<ProviderOffering>();
      repo.onOffering = () => gate.future;
      final pending = controller.create(draft(), repo.definition);
      controller.dispose();
      gate.complete(repo.currentOffering);
      expect(await pending, isNull);
      expect(repo.creates, 0);
      expect(controller.cancel.isCancelled, isTrue);
    },
  );
}
