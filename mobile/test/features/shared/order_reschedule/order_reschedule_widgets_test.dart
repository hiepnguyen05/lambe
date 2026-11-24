import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_reschedule/application/order_reschedule_controller.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/order_reschedule_card.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../order_safety/support/order_safety_fakes.dart'
    show FakeSafetyRepository;
import 'support/reschedule_fakes.dart';

Future<void> showCard(
  WidgetTester tester,
  FakeRescheduleRepository repo,
  RescheduleScope scope, {
  RescheduleOrder? snapshot,
  bool blocked = false,
  Future<void> Function()? refresh,
  Stream<OrderNotification>? events,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        orderNotificationEventsProvider.overrideWith(
          (ref) => events ?? const Stream.empty(),
        ),
        orderRescheduleProvider.overrideWith(
          (ref, scope) => OrderRescheduleController(
            repo,
            scope,
            safetyBlocked: () => blocked,
            clock: () => now,
          ),
        ),
        orderSafetyProvider.overrideWith(
          (ref, scope) => OrderSafetyController(FakeSafetyRepository(), scope),
        ),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: ListView(
            children: [
              OrderRescheduleCard(
                scope: scope,
                snapshot: snapshot ?? repo.current,
                mutationBlocked: blocked,
                refreshOrder: refresh ?? () async {},
              ),
            ],
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'SSE refetches the matching order once and ignores background events',
    (tester) async {
      final events = StreamController<OrderNotification>.broadcast();
      addTearDown(events.close);
      var refreshes = 0;
      await showCard(
        tester,
        FakeRescheduleRepository(),
        customerScope,
        events: events.stream,
        refresh: () async {
          refreshes++;
        },
      );
      OrderNotification notice(
        String id, {
        String role = 'CUSTOMER',
        String orderId = 'order',
      }) => OrderNotification(
        id: id,
        orderId: orderId,
        event: 'ORDER_RESCHEDULE_ACCEPTED',
        recipientRole: role,
        createdAt: now,
      );
      events.add(notice('one'));
      events.add(notice('one'));
      events.add(notice('other-order', orderId: 'another'));
      events.add(notice('other-role', role: 'PROVIDER'));
      await tester.pumpAndSettle();
      expect(refreshes, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      events.add(notice('background'));
      await tester.pump();
      expect(refreshes, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      events.add(notice('resumed'));
      await tester.pumpAndSettle();
      expect(refreshes, 2);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'customer pending card retains old time, displays proposal and hides another request',
    (tester) async {
      final repo = FakeRescheduleRepository()
        ..current = order(
          request: proposal(
            expires: DateTime.now().add(const Duration(hours: 1)),
          ),
        );
      await showCard(tester, repo, customerScope);
      expect(find.text('Đang chờ thợ phản hồi'), findsOneWidget);
      expect(find.textContaining('Lịch hiện tại: 09:00'), findsOneWidget);
      expect(find.textContaining('Giờ đề xuất: 11:00'), findsOneWidget);
      expect(find.text('Đề xuất giờ mới'), findsNothing);
      expect(find.text('Chấp nhận giờ mới'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'provider confirms before decision and shows server-approved time after refresh',
    (tester) async {
      final repo = FakeRescheduleRepository()
        ..current = order(
          request: proposal(
            expires: DateTime.now().add(const Duration(hours: 1)),
          ),
        );
      var refreshes = 0;
      await showCard(
        tester,
        repo,
        providerScope,
        refresh: () async {
          refreshes++;
        },
      );
      await tester.tap(find.text('Chấp nhận giờ mới'));
      await tester.pumpAndSettle();
      expect(repo.decisions, 0);
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(repo.decisions, 0);
      await tester.tap(find.text('Chấp nhận giờ mới'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      expect(repo.decisions, 1);
      expect(refreshes, 1);
      expect(find.text('Đã chấp nhận giờ mới'), findsOneWidget);
      expect(find.textContaining('Lịch hiện tại: 11:00'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('ineligible ASAP order has no reschedule UI or request', (
    tester,
  ) async {
    final repo = FakeRescheduleRepository()..current = order(type: 'ASAP');
    await showCard(tester, repo, customerScope);
    expect(find.text('Đổi lịch hẹn'), findsNothing);
    expect(repo.reads, 0);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('busy order disables proposal controls', (tester) async {
    final repo = FakeRescheduleRepository();
    await showCard(tester, repo, customerScope, blocked: true);
    final button = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'Đề xuất giờ mới'),
    );
    expect(button.onPressed, isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
