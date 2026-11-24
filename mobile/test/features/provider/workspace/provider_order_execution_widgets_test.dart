import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_order_app_bar.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_cancellation_bottom_sheet.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_order_customer_card.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_order_destination_card.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_order_settlement_card.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_order_status_progress.dart';

const _apiOrder = <String, dynamic>{
  'id': '12345678-0000-4000-8000-000000000000',
  'status': 'EN_ROUTE',
  'serviceName': 'Cắt tóc nam',
  'totalAmount': 180000,
  'addressLine': '12 Nguyễn Trãi, Hà Nội',
  'addressStreetLine': 'Tầng 2, số 12 Nguyễn Trãi',
  'addressWardName': 'Thanh Xuân Trung',
  'addressDistrictName': 'Thanh Xuân',
  'addressProvinceName': 'Hà Nội',
  'addressNote': 'Gọi trước khi lên',
  'customerNote': 'Cắt gọn hai bên',
  'contactPhone': '0900000000',
  'customer': <String, dynamic>{
    'id': 'customer-1',
    'fullName': 'Nguyễn An',
    'phone': '0900000000',
  },
};

void main() {
  testWidgets('execution cards render the flat provider order API contract', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ListView(
            children: [
              ProviderOrderCustomerCard(
                order: _apiOrder,
                onCall: (_) {},
                onRecordContactAttempt: () {},
              ),
              const ProviderOrderDestinationCard(order: _apiOrder),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Cắt tóc nam'), findsOneWidget);
    expect(find.text('Tầng 2, số 12 Nguyễn Trãi'), findsOneWidget);
    expect(find.text('Thanh Xuân Trung, Thanh Xuân, Hà Nội'), findsOneWidget);
    expect(find.textContaining('Gọi trước khi lên'), findsOneWidget);
  });

  testWidgets('settlement uses the amounts returned by the API', (
    tester,
  ) async {
    final order = <String, dynamic>{
      ..._apiOrder,
      'servicePriceAmount': 180000,
      'travelFeeAmount': 20000,
      'discountAmount': 40000,
      'totalAmount': 160000,
      'platformFundedAmount': 40000,
      'commissionAmount': 30000,
      'commissionRateBps': 1500,
    };

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProviderOrderSettlementCard(
            order: order,
            cashReceivedChecked: false,
            isActionLoading: false,
            onCashCheckChanged: (_) {},
            onConfirmComplete: () {},
            onBackToEvidence: () {},
            onReportUnpaid: () {},
          ),
        ),
      ),
    );

    expect(find.text('Sàn hoàn tiền voucher vào ví'), findsOneWidget);
    expect(find.text('Thu nhập ròng của đơn'), findsOneWidget);
    expect(find.textContaining('170.000'), findsOneWidget);
    expect(find.textContaining('Thu nhập thực tế vào ví'), findsNothing);
  });

  testWidgets('active app bar reports an incident without a fake SOS number', (
    tester,
  ) async {
    var reported = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          appBar: ProviderOrderAppBar(
            orderId: _apiOrder['id']! as String,
            status: 'EN_ROUTE',
            onReportIncident: () => reported = true,
          ),
        ),
      ),
    );

    expect(find.text('SOS'), findsNothing);
    await tester.tap(find.byTooltip('Báo sự cố'));
    expect(reported, isTrue);
  });

  testWidgets('status progress highlights the current order step', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ProviderOrderStatusProgress(status: 'ARRIVED')),
      ),
    );

    expect(find.text('Đã nhận'), findsOneWidget);
    expect(find.text('Di chuyển'), findsOneWidget);
    expect(find.text('Đã đến'), findsOneWidget);
    expect(find.text('Thực hiện'), findsOneWidget);
    expect(find.text('Hoàn tất'), findsOneWidget);
    expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
  });

  testWidgets('cancellation stays open when submission fails', (tester) async {
    var attempts = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => ProviderCancellationBottomSheet.show(
                context,
                status: 'EN_ROUTE',
                evidenceList: const [
                  <String, dynamic>{'type': 'INCIDENT'},
                ],
                contactAttempts: const [],
                onPickIncident: () async => true,
                onSubmit: (_, _) async {
                  attempts++;
                  return false;
                },
              ),
              child: const Text('Mở báo sự cố'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở báo sự cố'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Xe bị hỏng giữa đường');
    await tester.ensureVisible(find.text('Gửi yêu cầu hủy'));
    await tester.tap(find.text('Gửi yêu cầu hủy'));
    await tester.pumpAndSettle();

    expect(attempts, 1);
    expect(find.text('Báo sự cố & Yêu cầu hủy đơn'), findsOneWidget);
    expect(find.text('Xe bị hỏng giữa đường'), findsOneWidget);
  });
}
