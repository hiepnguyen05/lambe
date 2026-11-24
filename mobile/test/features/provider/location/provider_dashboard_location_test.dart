import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile/features/provider/location/application/provider_location_coordinator.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/provider/workspace/application/provider_dashboard_notifier.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/provider/workspace/domain/entities/provider_dashboard_entity.dart';
import 'package:mobile/features/provider/workspace/domain/repositories/provider_dashboard_repository.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/online_status_card.dart';

class _Repository implements ProviderDashboardRepository {
  bool online = false;
  int onlineCalls = 0;
  Completer<void>? held;
  bool failOnline = false;
  CancelToken? onlineToken;
  @override
  Future<bool> getAvailability({CancelToken? cancelToken}) async => online;
  @override
  Future<int> getSetupRadius({CancelToken? cancelToken}) async => 10;
  @override
  Future<void> goOnline(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  }) async {
    onlineCalls++;
    onlineToken = cancelToken;
    if (held != null) await held!.future;
    if (failOnline) throw StateError('network');
    online = true;
  }

  @override
  Future<void> goOffline({CancelToken? cancelToken}) async {
    online = false;
  }

  @override
  Future<void> heartbeat(
    ProviderLocationSample location, {
    CancelToken? cancelToken,
  }) async {}
  @override
  Future<void> updateSetupRadius(
    int radiusKm, {
    CancelToken? cancelToken,
  }) async {}
}

ProviderLocationCoordinator _locations(_Repository repo) =>
    ProviderLocationCoordinator(
      locate: (_) async => Position(
        latitude: 21,
        longitude: 105,
        timestamp: DateTime.now(),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      ),
      positions: (_) => const Stream.empty(),
      availability: (token) => repo.getAvailability(cancelToken: token),
      heartbeat: (_, _) async {},
      send: (_, _, _) async => null,
      getOrder: (_, _) async => {'status': 'EN_ROUTE'},
    );

class _StaticDashboard extends ProviderDashboardNotifier {
  final ProviderDashboardEntity value;
  _StaticDashboard(this.value);
  @override
  Future<ProviderDashboardEntity> build() async => value;
}

void main() {
  test('dashboard restores only server-confirmed online state', () async {
    final repo = _Repository()..online = true,
        locations = _locations(_Repository());
    final container = ProviderContainer(
      overrides: [
        providerDashboardRepositoryProvider.overrideWithValue(repo),
        providerLocationCoordinatorProvider.overrideWith((ref) => locations),
      ],
    );
    addTearDown(container.dispose);
    final value = await container.read(providerDashboardProvider.future);
    expect(value.isOnline, isTrue);
    expect(value.availabilityVerified, isTrue);
    expect(locations.online, isTrue);
    expect(repo.onlineCalls, 0);
  });
  test('rapid toggle calls send one online request and do not show optimistic online before ACK', () async {
    final repo = _Repository()..held = Completer<void>();
    final locations = _locations(repo);
    final container = ProviderContainer(
      overrides: [
        providerDashboardRepositoryProvider.overrideWithValue(repo),
        providerLocationCoordinatorProvider.overrideWith((ref) => locations),
      ],
    );
    addTearDown(container.dispose);
    await container.read(providerDashboardProvider.future);
    final first = container
        .read(providerDashboardProvider.notifier)
        .toggleOnlineStatus(true);
    await Future<void>.delayed(Duration.zero);
    await container
        .read(providerDashboardProvider.notifier)
        .toggleOnlineStatus(true);
    expect(repo.onlineCalls, 1);
    expect(container.read(providerDashboardProvider).value!.isOnline, isFalse);
    expect(container.read(providerDashboardProvider).value!.isUpdating, isTrue);
    repo.held!.complete();
    await first;
    expect(container.read(providerDashboardProvider).value!.isOnline, isTrue);
    expect(
      container.read(providerDashboardProvider).value!.isUpdating,
      isFalse,
    );
  });
  test('unknown online write reconciles actual server status instead of rolling back by assumption', () async {
    final repo = _Repository(),
        locations = _locations(_Repository()..online = true);
    final container = ProviderContainer(
      overrides: [
        providerDashboardRepositoryProvider.overrideWithValue(repo),
        providerLocationCoordinatorProvider.overrideWith((ref) => locations),
      ],
    );
    addTearDown(container.dispose);
    await container.read(providerDashboardProvider.future);
    repo.failOnline = true;
    expect(
      await container
          .read(providerDashboardProvider.notifier)
          .toggleOnlineStatus(true),
      isNotNull,
    );
    final state = container.read(providerDashboardProvider).value!;
    expect(state.isOnline, isTrue);
    expect(state.availabilityVerified, isTrue);
    expect(state.isUpdating, isFalse);
  });
  test(
    'disposing dashboard cancels a pending write and ignores its late ACK',
    () async {
      final repo = _Repository()..held = Completer<void>(),
          locations = _locations(_Repository());
      final container = ProviderContainer(
        overrides: [
          providerDashboardRepositoryProvider.overrideWithValue(repo),
          providerLocationCoordinatorProvider.overrideWith((ref) => locations),
        ],
      );
      await container.read(providerDashboardProvider.future);
      final pending = container
          .read(providerDashboardProvider.notifier)
          .toggleOnlineStatus(true);
      await Future<void>.delayed(Duration.zero);
      final token = repo.onlineToken!;
      container.dispose();
      expect(token.isCancelled, isTrue);
      repo.held!.complete();
      await pending;
      expect(locations.online, isFalse);
    },
  );
  for (final config in [(false, false), (true, true), (true, false)]) {
    testWidgets(
      'online switch verification=${config.$1} busy=${config.$2} stays truthful on a narrow screen',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              providerDashboardProvider.overrideWith(
                () => _StaticDashboard(
                  ProviderDashboardEntity(
                    isOnline: true,
                    availabilityVerified: config.$1,
                    isUpdating: config.$2,
                  ),
                ),
              ),
            ],
            child: const MaterialApp(home: Scaffold(body: OnlineStatusCard())),
          ),
        );
        await tester.pumpAndSettle();
        final control = tester.widget<Switch>(find.byType(Switch));
        expect(control.onChanged == null, !config.$1 || config.$2);
        if (!config.$1) {
          expect(find.text('Chưa xác minh hoạt động'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
    );
  }
}
