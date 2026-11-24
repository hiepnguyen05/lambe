import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/di/provider_services_providers.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';

import 'support/service_fakes.dart';

class _Auth implements AuthRepository {
  String id = 'account-a';
  @override
  Future<UserEntity?> getCurrentUser() async =>
      UserEntity(id: id, roles: const ['PROVIDER']);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Deferred extends FakeProviderServicesRepository {
  final results = <Completer<List<ProviderOffering>>>[];
  final tokens = <CancelToken>[];
  @override
  Future<List<ProviderOffering>> offerings(CancelToken cancel) {
    tokens.add(cancel);
    return results[tokens.length - 1].future;
  }
}

void main() {
  test('an approved request refreshes an already-open offering without starting dashboard GPS', () async {
    final repo = FakeProviderServicesRepository();
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(_Auth()),
        providerServicesRepositoryProvider.overrideWithValue(repo),
        serviceChangeMediaRepositoryProvider.overrideWithValue(
          FakeServiceMediaRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);
    await container.read(authNotifierProvider.notifier).refreshSession();
    final offering = container.listen(
      providerOfferingProvider('offering'),
      (_, _) {},
    );
    final request = container.listen(
      serviceChangeProvider('request'),
      (_, _) {},
    );
    addTearDown(offering.close);
    addTearDown(request.close);
    await Future<void>.delayed(Duration.zero);
    await container.pump();
    expect(
      container.read(providerOfferingProvider('offering')).value?.price,
      100000,
    );
    repo.currentOffering = offeringFromJson({
      ...offeringJson(),
      'priceAmount': 150000,
    });
    repo.current = changeFromJson(
      changeJson(status: ServiceChangeStatus.approved),
    );
    await container.read(serviceChangeProvider('request').notifier).load();
    await container.pump();
    await Future<void>.delayed(Duration.zero);
    expect(
      container.read(providerOfferingProvider('offering')).value?.price,
      150000,
    );
    expect(container.exists(providerDashboardProvider), isFalse);
    expect(container.exists(partnerProfileNotifierProvider), isFalse);
  });
  test('a late offerings response cannot cross an account change', () async {
    final auth = _Auth();
    final a = Completer<List<ProviderOffering>>(),
        b = Completer<List<ProviderOffering>>();
    final repo = _Deferred()..results.addAll([a, b]);
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        providerServicesRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);
    final listener = container.listen(ownProviderServicesProvider, (_, _) {});
    addTearDown(listener.close);
    await Future<void>.delayed(Duration.zero);
    await container.pump();
    expect(repo.tokens, hasLength(1));
    auth.id = 'account-b';
    await container
        .read(authNotifierProvider.notifier)
        .refreshSession(force: true);
    await Future<void>.delayed(Duration.zero);
    await container.pump();
    expect(repo.tokens, hasLength(2));
    b.complete([offeringFromJson(offeringJson(status: 'INACTIVE'))]);
    await container
        .read(ownProviderServicesProvider.future)
        .timeout(const Duration(seconds: 2));
    a.complete([offeringFromJson(offeringJson())]);
    await Future<void>.delayed(Duration.zero);
    expect(
      container.read(ownProviderServicesProvider).requireValue.single.status,
      'INACTIVE',
    );
    expect(repo.tokens.first.isCancelled, isTrue);
  });
  test(
    'unknown creation state is cancelled and cleared on account change',
    () async {
      final auth = _Auth(), repo = FakeProviderServicesRepository();
      repo.onCreate = () async => throw failure();
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          providerServicesRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);
      final listener = container.listen(
        newServiceChangeProvider(null),
        (_, _) {},
      );
      addTearDown(listener.close);
      await Future<void>.delayed(Duration.zero);
      final previous = container.read(newServiceChangeProvider(null).notifier);
      await previous.create(draft(), repo.definition);
      expect(previous.state.uncertain, isTrue);
      auth.id = 'account-b';
      await container
          .read(authNotifierProvider.notifier)
          .refreshSession(force: true);
      await Future<void>.delayed(Duration.zero);
      expect(previous.cancel.isCancelled, isTrue);
      expect(container.read(newServiceChangeProvider(null)).uncertain, isFalse);
    },
  );
}
