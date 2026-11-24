import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/application/provider_offering_controller.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';

import 'support/service_fakes.dart';

void main() {
  late FakeProviderServicesRepository repo;
  late ProviderOfferingController controller;
  var changed = 0;
  setUp(() {
    changed = 0;
    repo = FakeProviderServicesRepository();
    controller = ProviderOfferingController(
      repo,
      'offering',
      changed: () => changed++,
    );
  });
  tearDown(() => controller.dispose());
  test('pause uses the acknowledged server state and notifies the dashboard without auto-online', () async {
    await controller.load();
    expect(await controller.setActive(false), isTrue);
    expect(controller.state.value?.active, isFalse);
    expect(repo.puts, 1);
    expect(changed, 1);
  });
  test(
    'pending immediate order rejection retains the active offering',
    () async {
      await controller.load();
      repo.onAvailability = () async => throw failure(400);
      expect(await controller.setActive(false), isFalse);
      expect(controller.state.value?.active, isTrue);
      expect(controller.state.error, isNotNull);
    },
  );
  test(
    'suspension and inactive catalog blockers stop activation after fresh GET',
    () async {
      for (final json in [
        offeringJson(status: 'SUSPENDED', blocker: 'SUSPENDED'),
        offeringJson(status: 'INACTIVE', blocker: 'SERVICE_INACTIVE'),
      ]) {
        repo.currentOffering = offeringFromJson(json);
        expect(await controller.setActive(true), isFalse);
      }
      expect(repo.puts, 0);
    },
  );
  test(
    'timeout after committed availability change reconciles without replay',
    () async {
      repo.onAvailability = () async {
        repo.currentOffering = offeringFromJson(
          offeringJson(status: 'INACTIVE'),
        );
        throw failure();
      };
      expect(await controller.setActive(false), isTrue);
      expect(repo.puts, 1);
      expect(controller.state.value?.status, 'INACTIVE');
    },
  );
  test(
    'failed reconciliation locks mutation until a successful explicit reload',
    () async {
      repo.onAvailability = () async {
        repo.onOffering = () async => throw failure();
        throw failure();
      };
      await controller.setActive(false);
      expect(controller.state.uncertain, isTrue);
      expect(await controller.setActive(false), isFalse);
      expect(repo.puts, 1);
      await controller.load();
      expect(controller.state.uncertain, isTrue);
      repo.onOffering = null;
      await controller.load();
      expect(controller.state.uncertain, isFalse);
    },
  );
}
