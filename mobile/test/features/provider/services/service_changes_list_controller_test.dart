import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/application/service_changes_list_controller.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';

import 'support/service_fakes.dart';

void main() {
  test('pagination preserves backend order, deduplicates IDs and retains data after error', () async {
    final repo = FakeProviderServicesRepository();
    final controller = ServiceChangesListController(
      repo,
      ServiceChangeStatus.pending,
    );
    addTearDown(controller.dispose);
    repo.onPage = (filter, page) async {
      expect(filter, ServiceChangeStatus.pending);
      return ServiceChangesPage(
        [
          changeFromJson(changeJson(id: 'a')),
          if (page == 2) changeFromJson(changeJson(id: 'b')),
        ],
        page,
        3,
      );
    };
    await controller.load();
    await controller.load();
    expect(controller.state.items.map((v) => v.id), ['a', 'b']);
    repo.onPage = (_, _) async => throw failure();
    await controller.load();
    expect(controller.state.items, hasLength(2));
    expect(controller.state.hasMore, isTrue);
    expect(controller.state.error, isNotNull);
  });
  test(
    'a refresh supersedes an old page without rolling back the refreshed list',
    () async {
      final repo = FakeProviderServicesRepository();
      final controller = ServiceChangesListController(repo, null);
      addTearDown(controller.dispose);
      final old = Completer<ServiceChangesPage>();
      repo.onPage = (_, _) => old.future;
      final first = controller.load();
      repo.onPage = (_, page) async => ServiceChangesPage(
        [changeFromJson(changeJson(id: 'fresh'))],
        page,
        1,
      );
      await controller.load(refresh: true);
      old.complete(
        ServiceChangesPage([changeFromJson(changeJson(id: 'old'))], 1, 1),
      );
      await first;
      expect(controller.state.items.single.id, 'fresh');
      expect(controller.state.hasMore, isFalse);
    },
  );
}
