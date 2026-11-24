import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/provider/income/application/provider_wallet_notifier.dart';
import 'package:mobile/features/provider/income/di/provider_income_providers.dart';
import 'package:mobile/features/provider/income/domain/entities/topup_response_entity.dart';
import 'package:mobile/features/provider/income/domain/entities/wallet_entity.dart';
import 'package:mobile/features/provider/income/domain/entities/wallet_transaction_entity.dart';
import 'package:mobile/features/provider/income/domain/repositories/provider_wallet_repository.dart';
import 'package:mobile/features/provider/income/presentation/screens/sepay_payment_screen.dart';

const _pendingTopUp = TopUpResponseEntity(
  id: 'top-up',
  amount: 200000,
  status: 'PENDING_PAYMENT',
  provider: 'SEPAY',
  orderId: 'LAMBE-TOPUP',
);

TopUpResponseEntity _topUp(String status) => TopUpResponseEntity(
  id: _pendingTopUp.id,
  amount: _pendingTopUp.amount,
  status: status,
  provider: _pendingTopUp.provider,
  orderId: _pendingTopUp.orderId,
);

class _WalletRepository implements ProviderWalletRepository {
  @override
  Future<WalletEntity> getWalletBalance() async => const WalletEntity(
    balanceAmount: 0,
    heldAmount: 0,
    availableAmount: 0,
    currencyCode: 'VND',
  );

  @override
  Future<List<WalletTransactionEntity>> getTransactions({
    int limit = 50,
    int offset = 0,
  }) async => const [];

  @override
  Future<TopUpResponseEntity> createMomoTopUp(
    double amount, {
    String? redirectUrl,
  }) => throw UnimplementedError();

  @override
  Future<TopUpResponseEntity> createSepayTopUp(double amount) =>
      throw UnimplementedError();

  @override
  Future<TopUpResponseEntity> getTopUpDetail(String id) =>
      throw UnimplementedError();
}

class _WalletNotifier extends ProviderWalletNotifier {
  _WalletNotifier({this.result = _pendingTopUp}) : super(_WalletRepository());

  TopUpResponseEntity result;
  int checks = 0;

  @override
  Future<void> loadWalletData() async {}

  @override
  Future<TopUpResponseEntity?> checkTopUpStatus(String id) async {
    checks++;
    return result;
  }
}

Future<void> _mount(WidgetTester tester, _WalletNotifier notifier) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        providerWalletNotifierProvider.overrideWith((ref) => notifier),
      ],
      child: const MaterialApp(
        home: SepayPaymentScreen(
          topUp: _pendingTopUp,
          amountFormatted: '200.000 đ',
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('SePay polls 3, 5, 10 seconds and pauses in background', (
    tester,
  ) async {
    final notifier = _WalletNotifier();
    await _mount(tester, notifier);

    await tester.pump(const Duration(seconds: 3));
    expect(notifier.checks, 1);
    await tester.pump(const Duration(seconds: 5));
    expect(notifier.checks, 2);
    await tester.pump(const Duration(seconds: 10));
    expect(notifier.checks, 3);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 30));
    expect(notifier.checks, 3);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(notifier.checks, 4);
    await tester.pump(const Duration(seconds: 3));
    expect(notifier.checks, 5);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('SePay stops polling after a terminal response', (tester) async {
    final notifier = _WalletNotifier(result: _topUp('SUCCEEDED'));
    await _mount(tester, notifier);

    await tester.pump(const Duration(seconds: 3));
    expect(notifier.checks, 1);
    await tester.pump(const Duration(seconds: 30));
    expect(notifier.checks, 1);

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
