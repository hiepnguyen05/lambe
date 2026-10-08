import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../di/onboarding_providers.dart';
import 'onboarding_page_wrapper.dart';
import 'selection_tile.dart';

class AudienceStepWidget extends ConsumerWidget {
  const AudienceStepWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingNotifierProvider);
    final notifier = ref.read(onboardingNotifierProvider.notifier);

    return OnboardingPageWrapper(
      title: 'Bạn quan tâm dịch vụ dành cho ai?',
      subtitle: 'Chúng tôi sẽ gợi ý dịch vụ phù hợp nhất',
      child: Column(
        children: [
          SelectionTile(
            title: 'Cho Nam',
            isSelected: state.preferredAudience == 'MEN',
            onTap: () => notifier.updatePreferredAudience('MEN'),
            icon: Icons.face,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Cho Nữ',
            isSelected: state.preferredAudience == 'WOMEN',
            onTap: () => notifier.updatePreferredAudience('WOMEN'),
            icon: Icons.face_3,
          ),
          const SizedBox(height: 16),
          SelectionTile(
            title: 'Tất cả',
            isSelected: state.preferredAudience == 'ALL',
            onTap: () => notifier.updatePreferredAudience('ALL'),
            icon: Icons.group,
          ),
        ],
      ),
    );
  }
}
