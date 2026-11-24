import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/presentation/widgets/cancellation/order_cancellation_decision_card.dart';

void main() {
  testWidgets('keeps the cancellation decision visible when the API fails', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCancellationDecisionCard(
            request: const OrderCancellationRequestEntity(
              id: 'cancel-1',
              reason: 'TRANSPORT_ISSUE',
              status: 'PENDING_CUSTOMER',
            ),
            onDecide: ({required approve, note}) async => false,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Đồng ý hủy đơn'));
    await tester.pumpAndSettle();

    expect(find.text('Thợ gửi yêu cầu hủy đơn'), findsOneWidget);
    expect(
      find.text('Chưa xử lý được yêu cầu. Vui lòng thử lại.'),
      findsOneWidget,
    );
  });
}
