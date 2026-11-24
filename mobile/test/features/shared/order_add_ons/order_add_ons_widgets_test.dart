import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/order_add_ons/application/order_add_ons_controller.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';
import 'package:mobile/features/shared/order_add_ons/presentation/add_on_picker.dart';
import 'package:mobile/features/shared/order_add_ons/presentation/order_add_ons_section.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';

import '../order_safety/support/order_safety_fakes.dart'
    show FakeSafetyRepository;
import 'support/add_on_fakes.dart';

Future<void> showSection(
  WidgetTester tester,
  FakeAddOnsRepository repo,
  AddOnScope scope, {
  Stream<OrderNotification>? events,
  void Function(Map<String, dynamic>)? onServer,
  Future<void> Function()? refresh,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        orderAddOnsProvider.overrideWith(
          (ref, arg) => OrderAddOnsController(
            repo,
            arg,
            safetyBlocked: () => false,
            clock: () => now,
          ),
        ),
        orderSafetyProvider.overrideWith(
          (ref, arg) => OrderSafetyController(FakeSafetyRepository(), arg),
        ),
        orderNotificationEventsProvider.overrideWith(
          (ref) => events ?? const Stream.empty(),
        ),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: ListView(
            children: [
              OrderAddOnsSection(
                scope: scope,
                snapshot: AddOnOrder.fromJson(repo.current),
                onServerOrder: onServer,
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
    'picker scrolls on a narrow screen with keyboard insets and large text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 430);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 160);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      final repo = FakeAddOnsRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            orderAddOnsProvider.overrideWith(
              (ref, arg) => OrderAddOnsController(
                repo,
                arg,
                safetyBlocked: () => false,
                clock: () => now,
              ),
            ),
          ],
          child: MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: TextScaler.linear(1.5)),
              child: child!,
            ),
            home: const Scaffold(
              body: AddOnPicker(scope: providerScope, currency: 'VND'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.byType(TextField), 100);
      await tester.enterText(find.byType(TextField), 'Tư vấn thêm màu tóc');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(repo.proposals, 0);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'customer sees exact proposal and confirms before the decision POST',
    (tester) async {
      final repo = FakeAddOnsRepository()
        ..current = orderJson(
          items: [
            addOnJson(expires: DateTime.now().add(const Duration(minutes: 10))),
          ],
        );
      Map<String, dynamic>? received;
      await showSection(
        tester,
        repo,
        customerScope,
        onServer: (json) => received = json,
      );
      expect(
        find.textContaining('Tổng đơn nếu chấp nhận: 178.000'),
        findsOneWidget,
      );
      expect(find.textContaining('Hoa hồng phát sinh'), findsNothing);
      await tester.ensureVisible(find.text('Đồng ý thêm dịch vụ'));
      await tester.tap(find.text('Đồng ý thêm dịch vụ'));
      await tester.pumpAndSettle();
      expect(repo.decisions, 0);
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(repo.decisions, 0);
      await tester.tap(find.text('Đồng ý thêm dịch vụ'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      expect(repo.decisions, 1);
      expect(received?['totalAmount'], 178000);
      expect(
        find.textContaining('Nhuộm tóc · 20 phút · đã chấp nhận'),
        findsOneWidget,
      );
      expect(find.text('178.000 đ'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'provider can withdraw pending proposal and see commission from API',
    (tester) async {
      final repo = FakeAddOnsRepository()
        ..current = orderJson(
          items: [
            addOnJson(expires: DateTime.now().add(const Duration(minutes: 10))),
          ],
        );
      await showSection(tester, repo, providerScope);
      expect(find.textContaining('Hoa hồng phát sinh: 6.000'), findsOneWidget);
      await tester.ensureVisible(find.text('Rút đề nghị'));
      await tester.tap(find.text('Rút đề nghị'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      expect(repo.withdrawals, 1);
      expect(find.text('Thợ đã rút đề nghị'), findsOneWidget);
      expect(find.text('138.000 đ'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'options picker uses real available flags and does not submit a proposal',
    (tester) async {
      final repo = FakeAddOnsRepository()
        ..available = [option(available: false)];
      await showSection(tester, repo, providerScope);
      await tester.ensureVisible(find.text('Đề nghị thêm dịch vụ'));
      await tester.tap(find.text('Đề nghị thêm dịch vụ'));
      await tester.pumpAndSettle();
      expect(find.byType(AddOnPicker), findsOneWidget);
      expect(
        find.textContaining('Không đủ thời gian trước lịch tiếp theo.'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<ListTile>(find.widgetWithText(ListTile, 'Nhuộm tóc'))
            .enabled,
        isFalse,
      );
      expect(repo.proposals, 0);
      expect(repo.optionsReads, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'SSE filters order/role, deduplicates and ignores events in background',
    (tester) async {
      final stream = StreamController<OrderNotification>.broadcast();
      addTearDown(stream.close);
      final repo = FakeAddOnsRepository()
        ..current = orderJson(
          items: [
            addOnJson(expires: DateTime.now().add(const Duration(minutes: 10))),
          ],
        );
      var refreshes = 0;
      await showSection(
        tester,
        repo,
        customerScope,
        events: stream.stream,
        refresh: () async {
          refreshes++;
        },
      );
      OrderNotification notice(String id, {String role = 'CUSTOMER'}) =>
          OrderNotification(
            id: id,
            orderId: 'order',
            event: 'ORDER_ADD_ON_ACCEPTED',
            recipientRole: role,
            createdAt: now,
          );
      stream.add(notice('one'));
      stream.add(notice('one'));
      stream.add(notice('wrong', role: 'PROVIDER'));
      await tester.pumpAndSettle();
      expect(refreshes, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      stream.add(notice('background'));
      await tester.pump();
      expect(refreshes, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'expired proposal has no decision buttons and ineligible customer cannot propose',
    (tester) async {
      final repo = FakeAddOnsRepository()
        ..current = orderJson(
          items: [
            addOnJson(
              expires: DateTime.now().subtract(const Duration(seconds: 1)),
            ),
          ],
        );
      await showSection(tester, repo, customerScope);
      expect(find.text('Đề nghị đã hết hạn'), findsOneWidget);
      expect(find.text('Đồng ý thêm dịch vụ'), findsNothing);
      expect(find.text('Đề nghị thêm dịch vụ'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
