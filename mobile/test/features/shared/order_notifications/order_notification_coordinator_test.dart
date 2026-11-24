import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notification_coordinator.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/domain/repositories/customer_orders_repository.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';

void main() {
  testWidgets('renders child without intrusive snackbar popups', (
    tester,
  ) async {
    final messengerKey = GlobalKey<ScaffoldMessengerState>();
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, __) => const Scaffold())],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_SignedInRepository()),
          customerOrdersRepositoryProvider.overrideWithValue(
            _OrdersRepository('DENIED'),
          ),
          orderNotificationsProvider.overrideWith(
            (ref, userId) async => [
              OrderNotification.fromJson({
                'id': 'notice-1',
                'orderId': 'order-1',
                'event': 'CANCELLATION_REQUESTED',
                'recipientRole': 'CUSTOMER',
                'createdAt': '2026-10-20T07:00:00.000Z',
              }),
            ],
          ),
        ],
        child: MaterialApp(
          scaffoldMessengerKey: messengerKey,
          home: OrderNotificationCoordinator(
            router: router,
            messengerKey: messengerKey,
            child: const Scaffold(body: Text('Trang chủ')),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Trang chủ'), findsOneWidget);
    // Không hiện SnackBar gây phiền màn hình
    expect(find.byType(SnackBar), findsNothing);
    expect(find.text('Xem đơn'), findsNothing);
  });

  testWidgets('prompts customer for an unresolved cancellation request', (
    tester,
  ) async {
    final messengerKey = GlobalKey<ScaffoldMessengerState>();
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const Scaffold()),
        GoRoute(
          path: '/appointments/:id',
          builder: (_, __) => const Scaffold(),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_SignedInRepository()),
          customerOrdersRepositoryProvider.overrideWithValue(
            _OrdersRepository('PENDING_CUSTOMER'),
          ),
          orderNotificationsProvider.overrideWith(
            (ref, userId) async => [
              OrderNotification.fromJson({
                'id': 'notice-2',
                'orderId': 'order-1',
                'event': 'CANCELLATION_REQUESTED',
                'recipientRole': 'CUSTOMER',
                'createdAt': '2026-10-20T07:00:00.000Z',
              }),
            ],
          ),
        ],
        child: MaterialApp(
          scaffoldMessengerKey: messengerKey,
          home: OrderNotificationCoordinator(
            router: router,
            messengerKey: messengerKey,
            child: const Scaffold(body: Text('Trang chủ')),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Xem yêu cầu'), findsOneWidget);
  });
}

class _SignedInRepository implements AuthRepository {
  @override
  Future<UserEntity?> getCurrentUser() async =>
      const UserEntity(id: 'customer-1');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _OrdersRepository implements CustomerOrdersRepository {
  final String cancellationStatus;

  _OrdersRepository(this.cancellationStatus);

  @override
  Future<CustomerOrderEntity> getMyOrderById(String orderId) async =>
      CustomerOrderEntity(
        id: orderId,
        bookingType: 'ASAP',
        status: 'EN_ROUTE',
        serviceName: 'Cắt tóc',
        servicePriceAmount: 120000,
        totalAmount: 120000,
        cancellationRequest: OrderCancellationRequestEntity(
          id: 'cancel-1',
          reason: 'TRANSPORT_ISSUE',
          status: cancellationStatus,
        ),
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
