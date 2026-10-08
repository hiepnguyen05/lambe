import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../di/onboarding_providers.dart';
import 'onboarding_page_wrapper.dart';
import 'selection_tile.dart';

class GenderStepWidget extends ConsumerWidget {
  const GenderStepWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingNotifierProvider);
    final notifier = ref.read(onboardingNotifierProvider.notifier);

    return OnboardingPageWrapper(
      title: 'Bạn là ai?',
      subtitle: 'Giúp Lambe hiểu rõ hơn về bạn',
      child: Column(
        children: [
          SelectionTile(
            title: 'Nam',
            isSelected: state.gender == 'MALE',
            onTap: () => notifier.updateGender('MALE'),
            icon: Icons.male,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Nữ',
            isSelected: state.gender == 'FEMALE',
            onTap: () => notifier.updateGender('FEMALE'),
            icon: Icons.female,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Khác / Không muốn nói',
            isSelected: state.gender == 'OTHER',
            onTap: () => notifier.updateGender('OTHER'),
            icon: Icons.transgender,
          ),
        ],
      ),
    );
  }
}
