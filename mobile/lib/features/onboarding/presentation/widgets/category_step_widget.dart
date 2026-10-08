import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../di/onboarding_providers.dart';
import 'onboarding_icon_widget.dart';
import 'onboarding_page_wrapper.dart';

class CategoryStepWidget extends ConsumerWidget {
  const CategoryStepWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingNotifierProvider);
    final notifier = ref.read(onboardingNotifierProvider.notifier);

    if (state.options == null) return const SizedBox();

    return OnboardingPageWrapper(
      title: 'Danh mục yêu thích',
      subtitle: 'Chọn tối đa 3 nhóm để Lambe gợi ý đa dạng và phù hợp hơn',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Đã chọn ${state.categoryIds.length}/${OnboardingState.maxCategorySelections}',
            style: const TextStyle(
              color: Color(0xFF5F6F6C),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: state.options!.categories.map((cat) {
              final isSelected = state.categoryIds.contains(cat.id);
              return GestureDetector(
                onTap: () {
                  if (!notifier.toggleCategory(cat.id)) {
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Bạn chỉ có thể chọn tối đa 3 danh mục.',
                          ),
                        ),
                      );
                  }
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFF0F766E) : Colors.white,
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFF0F766E)
                          : const Color(0xFFBDC9C6).withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      OnboardingIconWidget(
                        iconStr: cat.iconUrl,
                        size: 20,
                        color: isSelected
                            ? Colors.white
                            : const Color(0xFF0F766E),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        cat.name,
                        style: TextStyle(
                          color: isSelected
                              ? Colors.white
                              : const Color(0xFF0B1C30),
                          fontWeight: isSelected
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
