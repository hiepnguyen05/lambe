import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/provider/services/application/service_change_controller.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';
import 'package:mobile/features/provider/services/domain/service_change_draft.dart';

import 'support/service_fakes.dart';

void main() {
  late FakeProviderServicesRepository repo;
  late FakeServiceMediaRepository media;
  late ServiceChangeController controller;
  setUp(() {
    repo = FakeProviderServicesRepository();
    media = FakeServiceMediaRepository();
    controller = ServiceChangeController(
      repo,
      media,
      'request',
      changed: () {},
    );
  });
  tearDown(() {
    if (controller.mounted) controller.dispose();
  });
  for (final disposeDuringPicker in [false, true]) {
    test(
      'gallery return ${disposeDuringPicker ? 'after disposal cannot upload to another session' : 'cannot lose its upload to a resume refresh'}',
      () async {
        final picker = Completer<XFile?>();
        var reads = 0;
        repo.onRead = () async {
          reads++;
          return repo.current;
        };
        final result = controller.pickAndUpload(
          'PORTFOLIO',
          () => picker.future,
        );
        await controller.load(); // The native gallery causes a resume event before returning the file.
        expect(reads, 0);
        if (disposeDuringPicker) controller.dispose();
        picker.complete(XFile.fromData(Uint8List(1)));
        expect(await result, !disposeDuringPicker);
        expect(media.uploads, disposeDuringPicker ? 0 : 1);
      },
    );
  }
  for (final status in [
    ServiceChangeStatus.draft,
    ServiceChangeStatus.needsChanges,
  ]) {
    test(
      '${status.wire} can be edited and submitted using the same request',
      () async {
        repo.current = changeFromJson(changeJson(status: status));
        final version = repo.current.updatedAt;
        expect(await controller.update(draft(price: 150000), version), isTrue);
        expect(controller.state.value?.status, ServiceChangeStatus.draft);
        expect(controller.state.value?.reviewNote, isNull);
        expect(await controller.submit(), isTrue);
        expect(controller.state.value?.status, ServiceChangeStatus.pending);
      },
    );
  }
  for (final status in [
    ServiceChangeStatus.pending,
    ServiceChangeStatus.approved,
    ServiceChangeStatus.rejected,
    ServiceChangeStatus.withdrawn,
  ]) {
    test(
      '${status.wire} rejects editing, submitting and uploading before any write',
      () async {
        repo.current = changeFromJson(changeJson(status: status));
        expect(
          await controller.update(draft(), repo.current.updatedAt),
          isFalse,
        );
        expect(await controller.submit(), isFalse);
        expect(
          await controller.upload('PORTFOLIO', XFile.fromData(Uint8List(1))),
          isFalse,
        );
        expect(repo.updates + repo.submissions + media.uploads, 0);
      },
    );
  }
  test(
    'a pending request may be withdrawn but cannot be resubmitted afterwards',
    () async {
      repo.current = changeFromJson(
        changeJson(status: ServiceChangeStatus.pending),
      );
      expect(await controller.withdraw(), isTrue);
      expect(await controller.submit(), isFalse);
      expect(repo.withdrawals, 1);
      expect(repo.submissions, 0);
    },
  );
  test('stale edit never overwrites a draft changed elsewhere', () async {
    final original = repo.current.updatedAt;
    repo.current = changeFromJson({
      ...changeJson(),
      'updatedAt': '2026-11-02T08:01:00Z',
    });
    expect(await controller.update(draft(), original), isFalse);
    expect(repo.updates, 0);
    expect(controller.state.error, contains('nơi khác'));
  });
  test('new-service drafts can change their name and category', () async {
    repo.current = changeFromJson(
      changeJson(type: ServiceChangeType.proposeNew),
    );
    final value = ServiceChangeDraft(
      type: ServiceChangeType.proposeNew,
      price: 150000,
      categoryId: 'another-category',
      name: 'Trang điểm sự kiện',
    );
    expect(await controller.update(value, repo.current.updatedAt), isTrue);
    expect(repo.sent?.name, 'Trang điểm sự kiện');
  });
  test(
    'invalid price, changed target and the ten-document cap prevent writes',
    () async {
      expect(
        await controller.update(draft(price: 49999), repo.current.updatedAt),
        isFalse,
      );
      expect(
        await controller.update(
          draft(type: ServiceChangeType.addExisting),
          repo.current.updatedAt,
        ),
        isFalse,
      );
      repo.current = changeFromJson({
        ...changeJson(),
        'documents': List.generate(
          10,
          (i) => {'id': 'doc-$i', 'type': 'PORTFOLIO', 'status': 'PENDING'},
        ),
      });
      expect(
        await controller.upload('PORTFOLIO', XFile.fromData(Uint8List(1))),
        isFalse,
      );
      expect(repo.updates + media.uploads, 0);
    },
  );
  test(
    'double submit is single flight and uncertain results require reload',
    () async {
      final gate = Completer<ServiceChange>();
      repo.onSubmit = () => gate.future;
      final first = controller.submit();
      await Future<void>.delayed(Duration.zero);
      expect(await controller.submit(), isFalse);
      repo.onRead = () async => throw failure();
      gate.completeError(failure());
      expect(await first, isFalse);
      expect(controller.state.uncertain, isTrue);
      expect(await controller.withdraw(), isFalse);
      expect(repo.submissions, 1);
      repo.onRead = null;
      repo.current = changeFromJson(
        changeJson(status: ServiceChangeStatus.pending),
      );
      await controller.load();
      expect(controller.state.uncertain, isFalse);
      expect(controller.state.value?.status, ServiceChangeStatus.pending);
    },
  );
  test(
    'timeout after submit reloads server status without repeating POST',
    () async {
      repo.onSubmit = () async {
        repo.current = changeFromJson(
          changeJson(status: ServiceChangeStatus.pending),
        );
        throw failure();
      };
      expect(await controller.submit(), isFalse);
      expect(controller.state.value?.status, ServiceChangeStatus.pending);
      expect(repo.submissions, 1);
      expect(await controller.submit(), isFalse);
      expect(repo.submissions, 1);
    },
  );
}
