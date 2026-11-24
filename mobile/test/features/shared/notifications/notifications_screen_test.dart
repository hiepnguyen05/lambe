import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/notifications/domain/entities/app_notification_entity.dart';
import 'package:mobile/features/shared/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile/features/shared/notifications/presentation/providers/notifications_providers.dart';
import 'package:mobile/features/shared/notifications/presentation/screens/notifications_screen.dart';
import 'package:mobile/features/shared/notifications/presentation/widgets/notification_category_chip.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

class _FakeNotificationsRepository implements NotificationsRepository {
  bool failRead = false;
  Completer<void>? readGate;
  @override
  Future<String?> resolveDestination(
    AppNotificationEntity notification,
  ) async => notification.destination;
  List<AppNotificationEntity> items = [
    AppNotificationEntity(
      id: 'n-order',
      title: 'Chuyên viên đã nhận lịch',
      body: 'Chuyên viên đang chuẩn bị dụng cụ.',
      category: NotificationCategory.order,
      createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
      isRead: false,
    ),
    AppNotificationEntity(
      id: 'n-promo',
      title: 'Giảm giá 20% cho bạn',
      body: 'Nhập mã LAMBE20 để hưởng ưu đãi.',
      category: NotificationCategory.promotion,
      createdAt: DateTime.now().subtract(const Duration(hours: 1)),
      isRead: false,
      metadata: {'voucherCode': 'LAMBE20'},
    ),
    AppNotificationEntity(
      id: 'n-sys',
      title: 'Chào mừng thành viên mới',
      body: 'Khám phá ngay các dịch vụ.',
      category: NotificationCategory.system,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      isRead: true,
    ),
  ];

  @override
  Future<List<AppNotificationEntity>> getNotifications({
    required String userId,
  }) async {
    return items;
  }

  @override
  Future<void> markAsRead(
    String notificationId, {
    String? userId,
    String entityType = 'ORDER',
  }) async {
    if (readGate != null) await readGate!.future;
    if (failRead) throw StateError('offline');
    items = items
        .map((i) => i.id == notificationId ? i.copyWith(isRead: true) : i)
        .toList();
  }

  @override
  Future<void> markAllAsRead({required String userId}) async {
    items = items.map((i) => i.copyWith(isRead: true)).toList();
  }

  @override
  Future<void> deleteNotification(String notificationId) async {
    items = items.where((i) => i.id != notificationId).toList();
  }
}

class _MockAuthRepo implements AuthRepository {
  @override
  Future<UserEntity?> getCurrentUser() async =>
      const UserEntity(id: 'test-user');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test(
    'read acknowledgement is required before local unread count changes',
    () async {
      final repo = _FakeNotificationsRepository()..readGate = Completer<void>();
      final container = ProviderContainer(
        overrides: [
          notificationsRepositoryProvider.overrideWithValue(repo),
          orderNotificationEventsProvider.overrideWith(
            (ref) => const Stream.empty(),
          ),
        ],
      );
      addTearDown(container.dispose);
      final listener = container.listen(
        notificationsNotifierProvider('test-user'),
        (_, __) {},
      );
      addTearDown(listener.close);
      final notifier = container.read(
        notificationsNotifierProvider('test-user').notifier,
      );
      await Future<void>.delayed(Duration.zero);
      final reading = notifier.markAsRead('n-order');
      expect(
        container
            .read(notificationsNotifierProvider('test-user'))
            .requireValue
            .first
            .isRead,
        isFalse,
      );
      repo.readGate!.complete();
      await reading;
      expect(
        container
            .read(notificationsNotifierProvider('test-user'))
            .requireValue
            .first
            .isRead,
        isTrue,
      );
    },
  );

  test('failed mark read leaves the backend notification unread', () async {
    final repo = _FakeNotificationsRepository()..failRead = true;
    final container = ProviderContainer(
      overrides: [
        notificationsRepositoryProvider.overrideWithValue(repo),
        orderNotificationEventsProvider.overrideWith(
          (ref) => const Stream.empty(),
        ),
      ],
    );
    addTearDown(container.dispose);
    final listener = container.listen(
      notificationsNotifierProvider('test-user'),
      (_, __) {},
    );
    addTearDown(listener.close);
    final notifier = container.read(
      notificationsNotifierProvider('test-user').notifier,
    );
    await Future<void>.delayed(Duration.zero);
    await expectLater(notifier.markAsRead('n-order'), throwsStateError);
    expect(
      container
          .read(notificationsNotifierProvider('test-user'))
          .requireValue
          .first
          .isRead,
      isFalse,
    );
  });

  testWidgets(
    'NotificationsScreen displays category filter chips and filters correctly',
    (tester) async {
      final fakeRepo = _FakeNotificationsRepository();
      final router = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (_, __) => const NotificationsScreen()),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderNotificationEventsProvider.overrideWith(
              (ref) => const Stream.empty(),
            ),
            authRepositoryProvider.overrideWithValue(_MockAuthRepo()),
            notificationsRepositoryProvider.overrideWithValue(fakeRepo),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );

      await tester.pumpAndSettle();

      // Kiểm tra các chip danh mục trong NotificationCategoryBar
      final categoryBar = find.byType(NotificationCategoryBar);
      expect(
        find.descendant(of: categoryBar, matching: find.text('Tất cả')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: categoryBar, matching: find.text('Đơn hàng')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: categoryBar, matching: find.text('Khuyến mãi')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: categoryBar, matching: find.text('Hệ thống')),
        findsOneWidget,
      );

      // Mặc định ở tab Tất cả: hiển thị cả 3 thông báo
      expect(find.text('Chuyên viên đã nhận lịch'), findsOneWidget);
      expect(find.text('Giảm giá 20% cho bạn'), findsOneWidget);
      expect(find.text('Chào mừng thành viên mới'), findsOneWidget);

      // Chuyển sang tab Khuyến mãi
      await tester.tap(
        find.descendant(of: categoryBar, matching: find.text('Khuyến mãi')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Giảm giá 20% cho bạn'), findsOneWidget);
      expect(find.text('Chuyên viên đã nhận lịch'), findsNothing);
      expect(find.text('Chào mừng thành viên mới'), findsNothing);

      // Chuyển sang tab Đơn hàng
      await tester.tap(
        find.descendant(of: categoryBar, matching: find.text('Đơn hàng')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chuyên viên đã nhận lịch'), findsOneWidget);
      expect(find.text('Giảm giá 20% cho bạn'), findsNothing);
    },
  );
}
