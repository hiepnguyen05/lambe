import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../di/provider_income_providers.dart';

import 'package:mobile/features/provider/workspace/presentation/widgets/provider_home_app_bar.dart';

import '../widgets/wallet/income_overview_section.dart';
import '../widgets/topup/topup_bottom_sheet.dart';
import '../widgets/wallet/transaction_history_list.dart';
import '../widgets/wallet/wallet_balance_card.dart';
import '../widgets/wallet/wallet_mechanism_info.dart';

class ProviderIncomeScreen extends ConsumerWidget {
  const ProviderIncomeScreen({super.key});

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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletState = ref.watch(providerWalletNotifierProvider);
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: CustomScrollView(
        slivers: [
          const ProviderHomeAppBar(),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  WalletBalanceCard(
                    wallet: walletState.wallet,
                    isLoading: walletState.isLoading,
                    onTopupTap: () => _showTopupSheet(context),
                    onQuickTopupSelect: (amount) {
                      // format number 100000 -> 100.000
                      final formatted = amount.toString().replaceAllMapped(
                        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
                        (Match m) => '${m[1]}.',
                      );
                      _showTopupSheet(context, initialAmount: formatted);
                    },
                  ),
                  const SizedBox(height: 24),

                  IncomeOverviewSection(isLoading: walletState.isLoading),
                  const SizedBox(height: 24),

                  const WalletMechanismInfo(),
                  const SizedBox(height: 24),

                  TransactionHistoryList(
                    transactions: walletState.transactions,
                    isLoading: walletState.isLoading,
                  ),
                  const SizedBox(height: 100), // padding for bottom nav
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
