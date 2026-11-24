import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/routing/app_mode.dart';
import 'package:mobile/core/routing/app_mode_provider.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';

const providerUser = UserEntity(
  id: 'provider-user',
  roles: ['CUSTOMER', 'PROVIDER'],
  onboardingStatus: 'COMPLETED',
);
const customerUser = UserEntity(
  id: 'customer-user',
  roles: ['CUSTOMER'],
  onboardingStatus: 'COMPLETED',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('provider can open customer home, appointments and explore', (
    tester,
  ) async {
    final router = _router(providerUser, AppMode.customer);
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    for (final route in ['/home', '/appointments', '/explore']) {
      router.go(route);
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, route);
    }
  });

  testWidgets(
    'customer cannot open provider workspace using a saved provider mode',
    (tester) async {
      final router = _router(customerUser, AppMode.provider);
      addTearDown(router.dispose);
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      router.go('/provider/home');
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/home');
    },
  );

  test('onboarding takes precedence over customer home', () {
    final pending = providerUser.copyWith(onboardingStatus: 'NOT_STARTED');
    expect(signedInLandingRoute(pending, AppMode.provider), '/provider/home');
    expect(signedInLandingRoute(pending, AppMode.customer), '/onboarding');
    expect(signedInRedirect(pending, AppMode.customer, '/home'), '/onboarding');
    expect(signedInRedirect(pending, AppMode.customer, '/onboarding'), isNull);
  });

  test('auth landing respects mode and role', () {
    expect(signedInRedirect(providerUser, AppMode.customer, '/auth'), '/home');
    expect(
      signedInRedirect(providerUser, AppMode.provider, '/auth/otp'),
      '/provider/home',
    );
    expect(signedInRedirect(customerUser, AppMode.provider, '/auth'), '/home');
  });

  test('mode survives a new container and is isolated by account', () async {
    final storage = SecureStorageService(const FlutterSecureStorage());
    final first = await _container(providerUser, storage);
    await first.read(appModeControllerProvider).switchMode(AppMode.provider);
    expect(
      await first.read(appModeProvider(providerUser.id).future),
      AppMode.provider,
    );
    first.dispose();

    final restored = await _container(providerUser, storage);
    addTearDown(restored.dispose);
    expect(
      await restored.read(appModeProvider(providerUser.id).future),
      AppMode.provider,
    );
    expect(
      await restored.read(appModeProvider(customerUser.id).future),
      AppMode.customer,
    );
  });

  test('customer cannot persist provider mode', () async {
    final storage = SecureStorageService(const FlutterSecureStorage());
    final container = await _container(customerUser, storage);
    addTearDown(container.dispose);
    await expectLater(
      container.read(appModeControllerProvider).switchMode(AppMode.provider),
      throwsStateError,
    );
    expect(await storage.getAppMode(customerUser.id), isNull);
  });

  test('logout clears mode while preserving installation identity', () async {
    final storage = SecureStorageService(const FlutterSecureStorage());
    final container = await _container(providerUser, storage);
    addTearDown(container.dispose);
    final installation = await storage.getInstallationId();
    final subscription = container.listen(
      appModeProvider(providerUser.id),
      (_, __) {},
    );
    addTearDown(subscription.close);
    await container
        .read(appModeControllerProvider)
        .switchMode(AppMode.provider);
    await container.read(authNotifierProvider.notifier).logout();
    expect(container.read(authNotifierProvider).valueOrNull, isNull);
    expect(await storage.getAppMode(providerUser.id), isNull);
    expect(await storage.getInstallationId(), installation);
    expect(
      await container.read(appModeProvider(providerUser.id).future),
      AppMode.customer,
    );
    final next = await _container(providerUser, storage);
    addTearDown(next.dispose);
    expect(
      await next.read(appModeProvider(providerUser.id).future),
      AppMode.provider,
    );
  });

  test('provider defaults to provider mode on first login with no saved preference', () async {
    final storage = SecureStorageService(const FlutterSecureStorage());
    final container = await _container(providerUser, storage);
    addTearDown(container.dispose);
    expect(
      await container.read(appModeProvider(providerUser.id).future),
      AppMode.provider,
    );
    expect(
      signedInLandingRoute(providerUser, AppMode.provider),
      '/provider/home',
    );
  });

  test('customer defaults to customer mode on first login with no saved preference', () async {
    final storage = SecureStorageService(const FlutterSecureStorage());
    final container = await _container(customerUser, storage);
    addTearDown(container.dispose);
    expect(
      await container.read(appModeProvider(customerUser.id).future),
      AppMode.customer,
    );
    expect(
      signedInLandingRoute(customerUser, AppMode.customer),
      '/home',
    );
  });

  test('storage failure does not publish a successful mode switch', () async {
    final storage = _FailingStorage();
    final container = await _container(providerUser, storage);
    addTearDown(container.dispose);
    expect(
      await container.read(appModeProvider(providerUser.id).future),
      AppMode.provider,
    );
    await expectLater(
      container.read(appModeControllerProvider).switchMode(AppMode.customer),
      throwsStateError,
    );
    expect(
      await container.read(appModeProvider(providerUser.id).future),
      AppMode.provider,
    );
  });

  test(
    'a save finishing after logout cannot restore the old session mode',
    () async {
      final storage = _DelayedStorage();
      final container = await _container(providerUser, storage);
      addTearDown(container.dispose);
      final switching = container
          .read(appModeControllerProvider)
          .switchMode(AppMode.customer);
      final failure = expectLater(switching, throwsStateError);
      await storage.started.future;
      await container.read(authNotifierProvider.notifier).logout();
      storage.finish.complete();
      await failure;
      expect(await storage.getAppMode(providerUser.id), isNull);
    },
  );
}

GoRouter _router(UserEntity user, AppMode mode) => GoRouter(
  initialLocation: '/auth',
  redirect: (_, state) => signedInRedirect(user, mode, state.matchedLocation),
  routes: [
    for (final path in [
      '/auth',
      '/home',
      '/appointments',
      '/explore',
      '/provider/home',
      '/onboarding',
    ])
      GoRoute(
        path: path,
        builder: (_, __) => Scaffold(body: Text(path)),
      ),
  ],
);

Future<ProviderContainer> _container(
  UserEntity user,
  SecureStorageService storage,
) async {
  final container = ProviderContainer(
    overrides: [
      secureStorageProvider.overrideWithValue(storage),
      authRepositoryProvider.overrideWithValue(_AuthRepository(user, storage)),
    ],
  );
  await container.read(authNotifierProvider.notifier).refreshSession();
  return container;
}

class _AuthRepository implements AuthRepository {
  final UserEntity user;
  final SecureStorageService storage;
  _AuthRepository(this.user, this.storage);

  @override
  Future<UserEntity?> getCurrentUser() async => user;
  @override
  Future<void> logout() => storage.clearAll();
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FailingStorage extends SecureStorageService {
  _FailingStorage() : super(const FlutterSecureStorage());
  @override
  Future<void> saveAppMode(String userId, String mode) async =>
      throw StateError('Storage unavailable');
}

class _DelayedStorage extends SecureStorageService {
  final started = Completer<void>();
  final finish = Completer<void>();
  _DelayedStorage() : super(const FlutterSecureStorage());

  @override
  Future<void> saveAppMode(String userId, String mode) async {
    started.complete();
    await finish.future;
    await super.saveAppMode(userId, mode);
  }
}
