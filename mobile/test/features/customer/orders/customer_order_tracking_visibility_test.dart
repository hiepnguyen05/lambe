import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/routing/app_route_observer.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/domain/repositories/customer_orders_repository.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/customer/orders/presentation/screens/customer_order_tracking_screen.dart';

class _OfflineOrders implements CustomerOrdersRepository {
  @override
  Future<CustomerOrderEntity> getMyOrderById(String orderId) async {
    throw StateError('offline');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets('tracking screen handles route and app lifecycle while offline', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          customerOrdersRepositoryProvider.overrideWithValue(_OfflineOrders()),
        ],
        child: MaterialApp(
          navigatorObservers: [appRouteObserver],
          home: const CustomerOrderTrackingScreen(orderId: 'order-1'),
        ),
      ),
    );
    await tester.pump();

    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('Other screen')),
      ),
    );
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    navigator.pop();
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();

    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
