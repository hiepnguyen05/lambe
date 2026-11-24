import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_main_screen.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_facebook_composer_card.dart';
import 'package:mobile/features/shared/notifications/presentation/providers/notifications_providers.dart';

class _FakeAuthRepo implements AuthRepository {
  final UserEntity user;
  _FakeAuthRepo(this.user);
  @override
  Future<UserEntity?> getCurrentUser() async => user;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  final providerUser = const UserEntity(
    id: 'provider-1',
    roles: ['PROVIDER'],
    fullName: 'Chuyên viên Lan',
  );

  testWidgets(
    'provider main screen renders explore tab and switches branch without overflow on 320px',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final router = GoRouter(
        initialLocation: '/provider/home',
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (context, state, navigationShell) =>
                ProviderMainScreen(navigationShell: navigationShell),
            branches: [
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/provider/home',
                    builder: (_, __) => const Text('Screen Home'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/provider/orders',
                    builder: (_, __) => const Text('Screen Orders'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/provider/explore',
                    builder: (_, __) => const Text('Screen Explore'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/provider/income',
                    builder: (_, __) => const Text('Screen Income'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/provider/reviews',
                    builder: (_, __) => const Text('Screen Reviews'),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/provider/account',
                    builder: (_, __) => const Text('Screen Account'),
                  ),
                ],
              ),
            ],
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Đơn đặt'), findsOneWidget);
      expect(find.text('Khám phá'), findsOneWidget);
      expect(find.text('Thu nhập'), findsOneWidget);
      expect(find.text('Đánh giá'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);
      expect(find.text('Screen Home'), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Tap on 'Khám phá' tab
      await tester.tap(find.text('Khám phá'));
      await tester.pumpAndSettle();

      expect(find.text('Screen Explore'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'feed facebook composer card shows post and media actions for partner',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(_FakeAuthRepo(providerUser)),
            totalUnreadNotificationsCountProvider.overrideWithValue(0),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: FeedFacebookComposerCard(),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đăng bài'), findsOneWidget);
      expect(find.text('Ảnh/Video'), findsOneWidget);
      expect(find.text('Dịch vụ'), findsOneWidget);
      expect(find.text('Chia sẻ tác phẩm làm đẹp mới...'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'feed facebook composer card fits narrow 320px screen without RenderFlex overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(_FakeAuthRepo(providerUser)),
            totalUnreadNotificationsCountProvider.overrideWithValue(0),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: FeedFacebookComposerCard(),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đăng bài'), findsOneWidget);
      expect(find.text('Ảnh/Video'), findsOneWidget);
      expect(find.text('Dịch vụ'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
