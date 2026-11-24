import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/data/order_safety_repository.dart';

import 'support/order_safety_fakes.dart';

class _Session extends AuthRepository {
  UserEntity? user = const UserEntity(id: 'customer');
  @override
  Future<UserEntity?> getCurrentUser() async => user;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test(
    'unresolved SOS survives route disposal, CLOSED releases retained state',
    () async {
      final session = _Session();
      final repo = FakeSafetyRepository();
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(session),
          orderSafetyRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authNotifierProvider.notifier).refreshSession();
      final listener = container.listen(orderSafetyProvider(scope), (_, _) {});
      final controller = container.read(orderSafetyProvider(scope).notifier);
      await controller.raise();
      listener.close();
      await container.pump();
      expect(controller.mounted, isTrue);
      expect(container.read(orderSafetyProvider(scope)).blocksOrder, isTrue);
      repo.onMine = () async => closed;
      await controller.refresh();
      await container.pump();
      expect(controller.mounted, isFalse);
    },
  );

  test(
    'account changes dispose old SOS controller and do not expose its incident',
    () async {
      final session = _Session();
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(session),
          orderSafetyRepositoryProvider.overrideWithValue(
            FakeSafetyRepository(),
          ),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authNotifierProvider.notifier).refreshSession();
      final listener = container.listen(orderSafetyProvider(scope), (_, _) {});
      addTearDown(listener.close);
      final old = container.read(orderSafetyProvider(scope).notifier);
      await old.raise();
      session.user = const UserEntity(id: 'other');
      await container
          .read(authNotifierProvider.notifier)
          .refreshSession(force: true);
      await container.pump();
      expect(old.mounted, isFalse);
      expect(old.cancel.isCancelled, isTrue);
      expect(container.read(orderSafetyProvider(scope)).incident, isNull);
    },
  );
}
