import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/features/provider/workspace/application/provider_earnings_summary.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';

import '../../di/provider_income_providers.dart';
import '../widgets/topup/topup_bottom_sheet.dart';
import '../widgets/wallet/income_overview_section.dart';
import '../widgets/wallet/transaction_history_list.dart';
import '../widgets/wallet/wallet_balance_card.dart';
import '../widgets/wallet/wallet_mechanism_info.dart';

class ProviderIncomeScreen extends ConsumerStatefulWidget {
  const ProviderIncomeScreen({super.key});

  @override
  ConsumerState<ProviderIncomeScreen> createState() =>
      _ProviderIncomeScreenState();
}

class _ProviderIncomeScreenState extends ConsumerState<ProviderIncomeScreen> {
  IncomePeriod _selectedPeriod = IncomePeriod.today;

  void _showTopupSheet(
    BuildContext context, {
    String initialAmount = '200.000',
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => TopupBottomSheet(initialAmount: initialAmount),
    );
  }

  Future<void> _refresh() async {
    await Future.wait([
      ref.read(providerWalletNotifierProvider.notifier).loadWalletData(),
      ref.refresh(providerCompletedOrdersProvider.future).then((_) {}),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final walletState = ref.watch(providerWalletNotifierProvider);
    final earningsAsync = ref.watch(providerEarningsProvider(_selectedPeriod));
    final earnings = earningsAsync.valueOrNull ?? const ProviderPeriodEarnings();
    final isIncomeLoading =
        earningsAsync.isLoading && !earningsAsync.hasValue;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            const SliverAppBar(
              pinned: true,
              elevation: 0,
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              automaticallyImplyLeading: false,
              centerTitle: true,
              title: Text(
                'Thu nhập',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    WalletBalanceCard(
                      wallet: walletState.wallet,
                      isLoading:
                          walletState.isLoading && walletState.wallet == null,
                      onTopupTap: () => _showTopupSheet(context),
                      onQuickTopupSelect: (amount) {
                        _showTopupSheet(
                          context,
                          initialAmount: CurrencyUtils.vndDecimal.format(
                            amount,
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 24),

                    IncomeOverviewSection(
                      netIncome: earnings.netIncome,
                      grossIncome: earnings.grossIncome,
                      commissionDeducted: earnings.commissionDeducted,
                      platformSubsidy: earnings.platformSubsidy,
                      completedOrders: earnings.completedOrders,
                      isLoading: isIncomeLoading,
                      selectedPeriod: _selectedPeriod,
                      onPeriodChanged: (period) =>
                          setState(() => _selectedPeriod = period),
                    ),
                    const SizedBox(height: 24),

                    const WalletMechanismInfo(),
                    const SizedBox(height: 24),

                    TransactionHistoryList(
                      transactions: walletState.transactions,
                      isLoading: walletState.isLoading,
                      errorMessage: walletState.error,
                      onRetry: () => ref
                          .read(providerWalletNotifierProvider.notifier)
                          .loadWalletData(),
                    ),
                    const SizedBox(height: 100), // padding for bottom nav
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
