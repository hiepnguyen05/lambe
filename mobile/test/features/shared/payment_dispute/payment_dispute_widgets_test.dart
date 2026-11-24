import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_reason_dialog.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_screen.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_summary.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_updates.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import 'support/payment_dispute_fakes.dart';

void main() {
  for (final status in ['PAYMENT_DISPUTE', 'DISPUTED', 'COMPLETED']) {
    testWidgets(
      'customer $status is truthful and hides held commission amount',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: PaymentDisputeSummary(
                order: PaymentDisputeOrder.fromJson(orderJson(status: status)),
                role: PaymentDisputeRole.customer,
              ),
            ),
          ),
        );
        expect(find.textContaining('30.000'), findsNothing);
        expect(find.textContaining(reason), findsOneWidget);
        expect(
          find.text(
            status == 'DISPUTED'
                ? 'Đã xác minh chưa thanh toán'
                : status == 'COMPLETED'
                ? 'Đã xác minh thanh toán'
                : 'Đang chờ xác minh thanh toán',
          ),
          findsOneWidget,
        );
        expect(find.textContaining('Gửi lúc: 15:00'), findsOneWidget);
      },
    );
  }
  testWidgets(
    'provider sees actual ACTIVE hold without claiming it is captured',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PaymentDisputeSummary(
              order: PaymentDisputeOrder.fromJson(
                orderJson(status: 'DISPUTED'),
              ),
              role: PaymentDisputeRole.provider,
            ),
          ),
        ),
      );
      expect(find.text('Hoa hồng đang tạm giữ: 30.000 đ'), findsOneWidget);
      expect(find.textContaining('chưa được khấu trừ'), findsOneWidget);
    },
  );
  testWidgets(
    'dispute screen exposes refresh without review or completion controls',
    (tester) async {
      var reads = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderNotificationEventsProvider.overrideWith(
              (ref) => const Stream.empty(),
            ),
          ],
          child: MaterialApp(
            home: PaymentDisputeScreen(
              scope: customerScope,
              snapshot: PaymentDisputeOrder.fromJson(
                orderJson(status: 'PAYMENT_DISPUTE'),
              ),
              refreshOrder: () async {
                reads++;
              },
            ),
          ),
        ),
      );
      expect(find.text('Hoàn thành đơn'), findsNothing);
      expect(find.text('Viết đánh giá'), findsNothing);
      await tester.tap(find.text('Tải lại trạng thái'));
      await tester.pump();
      expect(reads, 1);
    },
  );
  testWidgets(
    'reason dialog validates, trims and remains usable at narrow width',
    (tester) async {
      tester.view.physicalSize = const Size(320, 580);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      String? sent;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  sent = await showPaymentDisputeReasonDialog(context);
                },
                child: const Text('Báo chưa đủ'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Báo chưa đủ'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      await tester.enterText(find.byType(TextField), '  $reason  ');
      await tester.pump();
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
      expect(sent, reason);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'SSE filters by order, role and event, deduplicates and ignores background',
    (tester) async {
      final events = StreamController<OrderNotification>();
      addTearDown(events.close);
      var reads = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderNotificationEventsProvider.overrideWith(
              (ref) => events.stream,
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: PaymentDisputeUpdates(
                scope: customerScope,
                refreshOrder: () async {
                  reads++;
                },
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      void send(
        String id, {
        String order = 'order',
        String role = 'CUSTOMER',
        String event = 'PAYMENT_DISPUTE_OPENED',
      }) => events.add(
        OrderNotification(
          id: id,
          orderId: order,
          event: event,
          recipientRole: role,
          createdAt: DateTime.utc(2026),
        ),
      );
      send('wrong-order', order: 'other');
      send('wrong-role', role: 'PROVIDER');
      send('wrong-event', event: 'ORDER_ACCEPTED');
      await tester.pump();
      expect(reads, 0);
      send('ok');
      await tester.pump();
      send('ok');
      await tester.pump();
      expect(reads, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      send('background');
      await tester.pump();
      expect(reads, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      send('resumed', event: 'PAYMENT_DISPUTE_CONFIRM_PAID');
      await tester.pump();
      expect(reads, 2);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
