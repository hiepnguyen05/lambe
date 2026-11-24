import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_button.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_screen.dart';
import 'package:mobile/features/customer/orders/presentation/widgets/detail/order_status_badge.dart';

import 'support/order_safety_fakes.dart'
    show FakeSafetyRepository, scope, own, closed;

void main() {
  testWidgets(
    'cancel confirmation sends nothing; confirmed SOS needs no form',
    (tester) async {
      final repo = FakeSafetyRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderSafetyProvider.overrideWith(
              (ref, arg) => OrderSafetyController(repo, arg),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(body: OrderSafetyButton(scope: scope)),
          ),
        ),
      );
      await tester.tap(find.text('SOS'));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(repo.posts, 0);
      await tester.tap(find.text('SOS'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi SOS'));
      await tester.pumpAndSettle();
      expect(repo.posts, 1);
    },
  );

  testWidgets(
    'OPEN safety screen has no ordinary completion or cancellation action',
    (tester) async {
      final repo = FakeSafetyRepository();
      final controller = OrderSafetyController(repo, scope);
      await controller.raise();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderSafetyProvider.overrideWith((ref, arg) => controller),
          ],
          child: MaterialApp(
            home: OrderSafetyScreen(scope: scope, refreshOrder: () async {}),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Đơn đang tạm dừng để chờ hỗ trợ'), findsOneWidget);
      expect(find.text('Hoàn thành đơn'), findsNothing);
      expect(find.text('Hủy đơn'), findsNothing);
      expect(find.text('Bổ sung ảnh khi đã an toàn'), findsOneWidget);
      expect(find.textContaining('chưa có xác nhận nhân sự'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 16));
      expect(repo.gets, 1);
    },
  );

  testWidgets(
    'closed incident renders closure without an invented support note or upload',
    (tester) async {
      final repo = FakeSafetyRepository()..onMine = () async => closed;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderSafetyProvider.overrideWith(
              (ref, arg) => OrderSafetyController(repo, arg),
            ),
          ],
          child: MaterialApp(
            home: OrderSafetyScreen(scope: scope, refreshOrder: () async {}),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Hồ sơ an toàn đã đóng'), findsOneWidget);
      expect(find.text('Bổ sung ảnh khi đã an toàn'), findsNothing);
      await tester.pump(const Duration(seconds: 16));
      expect(repo.gets, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('safety poll pauses in background and refreshes on resume', (
    tester,
  ) async {
    final repo = FakeSafetyRepository()..onMine = () async => own;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          orderSafetyProvider.overrideWith(
            (ref, arg) => OrderSafetyController(repo, arg),
          ),
        ],
        child: MaterialApp(
          home: OrderSafetyScreen(scope: scope, refreshOrder: () async {}),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final initial = repo.gets;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 31));
    expect(repo.gets, initial);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(repo.gets, initial + 1);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('SAFETY_HOLD badge takes precedence over pending cancellation', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: OrderStatusBadge(
            status: 'SAFETY_HOLD',
            cancellationStatus: 'PENDING_CUSTOMER',
          ),
        ),
      ),
    );
    expect(find.text('Tạm dừng vì an toàn'), findsOneWidget);
    expect(find.text('Chờ duyệt hủy'), findsNothing);
  });
}
