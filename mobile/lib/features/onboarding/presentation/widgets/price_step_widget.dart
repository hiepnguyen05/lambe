import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../di/onboarding_providers.dart';
import 'onboarding_page_wrapper.dart';
import 'selection_tile.dart';

class PriceStepWidget extends ConsumerWidget {
  const PriceStepWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingNotifierProvider);
    final notifier = ref.read(onboardingNotifierProvider.notifier);

    return OnboardingPageWrapper(
      title: 'Mức giá ưu tiên',
      subtitle: 'Giúp lọc kết quả thợ làm đẹp phù hợp với túi tiền',
      child: Column(
        children: [
          SelectionTile(
            title: 'Tiết kiệm',
            isSelected: state.pricePreference == 'BUDGET',
            onTap: () => notifier.updatePricePreference('BUDGET'),
            icon: Icons.savings,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Cân bằng (Tiêu chuẩn)',
            isSelected: state.pricePreference == 'BALANCED',
            onTap: () => notifier.updatePricePreference('BALANCED'),
            icon: Icons.account_balance_wallet,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Cao cấp (Premium)',
            isSelected: state.pricePreference == 'PREMIUM',
            onTap: () => notifier.updatePricePreference('PREMIUM'),
            icon: Icons.workspace_premium,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Không quan trọng',
            isSelected: state.pricePreference == 'NO_PREFERENCE',
            onTap: () => notifier.updatePricePreference('NO_PREFERENCE'),
            icon: Icons.all_inclusive,
          ),
        ],
      ),
    );
  }
}
