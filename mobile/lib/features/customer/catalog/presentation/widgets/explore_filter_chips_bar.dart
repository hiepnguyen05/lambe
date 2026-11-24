import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/lambe_icon_widget.dart';
import 'package:mobile/features/customer/home/presentation/providers/home_categories_provider.dart';
import '../providers/explore_search_provider.dart';

class ExploreFilterChipsBar extends ConsumerWidget {
  const ExploreFilterChipsBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filterState = ref.watch(exploreSearchFilterProvider);
    final filterNotifier = ref.read(exploreSearchFilterProvider.notifier);
    final categoriesAsync = ref.watch(homeCategoriesProvider);

    // Thứ tự chip chuẩn theo mẫu HTML:
    // 1. Tất cả
    // 2. Các danh mục động từ API (ví dụ Cắt tóc, Gội dưỡng sinh, Uốn & Nhuộm...)
    // 3. Gần bạn (< 3km)
    // 4. Đánh giá 4.9★+
    final List<QuickFilterChipItem> chips = [
      const QuickFilterChipItem(
        id: 'all',
        label: 'Tất cả',
        type: QuickFilterChipType.all,
      ),
    ];

    final dynamicCategories = categoriesAsync.valueOrNull ?? [];
    for (final cat in dynamicCategories) {
      chips.add(
        QuickFilterChipItem(
          id: 'cat_${cat.slug}',
          label: cat.name,
          type: QuickFilterChipType.category,
          categorySlug: cat.slug,
          iconName: cat.iconUrl,
        ),
      );
    }

    chips.addAll(const [
      QuickFilterChipItem(
        id: 'near_me',
        label: 'Gần bạn (< 3km)',
        type: QuickFilterChipType.nearMe,
      ),
      QuickFilterChipItem(
        id: 'high_rating',
        label: 'Đánh giá 4.9★+',
        type: QuickFilterChipType.highRating,
      ),
    ]);

    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final chip = chips[index];
          final isSelected = filterState.selectedChipId == chip.id;

          return _buildChip(
            chip: chip,
            isSelected: isSelected,
            onTap: () => filterNotifier.selectChip(chip),
          );
        },
      ),
    );
  }

  Widget _buildChip({
    required QuickFilterChipItem chip,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    Widget? icon;
    switch (chip.type) {
      case QuickFilterChipType.all:
        icon = null; // Theo mẫu HTML: "Tất cả" không có icon
        break;
      case QuickFilterChipType.nearMe:
        icon = Icon(
          Icons.near_me_rounded,
          size: 15,
          color: isSelected ? Colors.white : AppColors.primary,
        );
        break;
      case QuickFilterChipType.highRating:
        icon = Icon(
          Icons.star_rounded,
          size: 15,
          color: isSelected ? Colors.white : AppColors.secondary,
        );
        break;
      case QuickFilterChipType.category:
        if (chip.iconName != null && chip.iconName!.isNotEmpty) {
          icon = LambeIconWidget(
            iconStr: chip.iconName!,
            size: 15,
            color: isSelected ? Colors.white : AppColors.primary,
            fallbackIcon: Icons.content_cut_rounded,
          );
        } else {
          icon = Icon(
            Icons.content_cut_rounded,
            size: 15,
            color: isSelected ? Colors.white : AppColors.primary,
          );
        }
        break;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6), // px-3.5 py-1.5
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primaryContainer // bg-primary-container
                : AppColors.surfaceContainerLowest, // bg-surface-container-lowest
            borderRadius: BorderRadius.circular(100), // rounded-full
            border: Border.all(
              color: isSelected
                  ? AppColors.primaryContainer
                  : AppColors.outlineVariant.withValues(alpha: 0.20), // border-outline-variant/20
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                icon,
                const SizedBox(width: 6),
              ],
              Text(
                chip.label,
                style: TextStyle(
                  fontSize: 12, // font-label-md
                  fontWeight: FontWeight.w600,
                  color: isSelected
                      ? AppColors.onPrimary // text-on-primary (#FFFFFF)
                      : AppColors.onSurfaceVariant, // text-on-surface-variant (#3E4947)
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
