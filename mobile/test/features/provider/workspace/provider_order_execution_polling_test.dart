import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/data/datasources/provider_orders_remote_datasource.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_order_execution_screen.dart';
import 'package:mobile/core/routing/app_route_observer.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/data/order_safety_repository.dart';

class _CountingOrders extends DioProviderOrdersRemoteDataSource {
  _CountingOrders() : super(Dio());

  int detailCalls = 0;

  @override
  Future<Map<String, dynamic>> getProviderOrderDetail(String orderId) async {
    detailCalls++;
    throw StateError('offline');
  }
}

void main() {
  test(
    'provider order pauses requests while hidden and refreshes on return',
    () {
      fakeAsync((clock) {
        final source = _CountingOrders();
        final container = ProviderContainer(
          overrides: [
            providerOrdersRemoteDataSourceProvider.overrideWithValue(source),
            orderSafetyProvider.overrideWith(
              (ref, scope) =>
                  OrderSafetyController(OrderSafetyRepository(Dio()), scope),
            ),
          ],
        );
        final listener = container.listen(
          providerOrderExecutionNotifierProvider('order-1'),
          (_, __) {},
        );
        final notifier = container.read(
          providerOrderExecutionNotifierProvider('order-1').notifier,
        );
        clock.flushMicrotasks();
        expect(source.detailCalls, 1);

        notifier.pausePolling();
        clock.elapse(const Duration(seconds: 36));
        clock.flushMicrotasks();
        expect(source.detailCalls, 1);

        notifier.resumePolling();
        clock.flushMicrotasks();
        expect(source.detailCalls, 2);
        clock.elapse(const Duration(seconds: 12));
        clock.flushMicrotasks();
        expect(source.detailCalls, 3);

        listener.close();
        container.dispose();
      });
    },
  );

  testWidgets('order screen stops polling behind a route and in background', (
    tester,
  ) async {
    final source = _CountingOrders();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          providerOrdersRemoteDataSourceProvider.overrideWithValue(source),
          orderSafetyProvider.overrideWith(
            (ref, scope) =>
                OrderSafetyController(OrderSafetyRepository(Dio()), scope),
          ),
        ],
        child: MaterialApp(
          navigatorObservers: [appRouteObserver],
          home: const ProviderOrderExecutionScreen(orderId: 'order-1'),
        ),
      ),
    );
    await tester.pump();
    expect(source.detailCalls, 1);

    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('Other screen')),
      ),
    );
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 36));
    expect(source.detailCalls, 1);

    navigator.pop();
    await tester.pumpAndSettle();
    expect(source.detailCalls, 2);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 36));
    expect(source.detailCalls, 2);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(source.detailCalls, 3);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
