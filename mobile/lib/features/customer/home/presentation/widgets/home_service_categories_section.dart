import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/lambe_icon_widget.dart';

import '../providers/home_categories_provider.dart';

class HomeServiceCategoriesSection extends ConsumerWidget {
  final VoidCallback? onSeeAllTap;
  final ValueChanged<HomeCategoryItem>? onCategoryTap;

  const HomeServiceCategoriesSection({
    super.key,
    this.onSeeAllTap,
    this.onCategoryTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(homeCategoriesProvider);
    final allCategories = categoriesAsync.valueOrNull ?? kDefaultCoreCategories;
    final categories = allCategories.take(8).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Text(
              'Dịch vụ tại nhà',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: AppColors.onSurface,
              ),
            ),
            InkWell(
              onTap: onSeeAllTap,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Text(
                  'Tất cả ${allCategories.length} dịch vụ',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // 4x2 Category Grid (Chỉ bo viền quanh biểu tượng, không bo quanh tên)
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: 8,
            mainAxisSpacing: 12,
            childAspectRatio: 0.82,
          ),
          itemCount: categories.length,
          itemBuilder: (context, index) {
            final cat = categories[index];

            return InkWell(
              onTap: () => onCategoryTap?.call(cat),
              borderRadius: BorderRadius.circular(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Squircle Icon Box (Chỉ phần biểu tượng này có nền bo tròn)
                  Container(
                    width: 50,
                    height: 50,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: AppColors.primaryFixed.withValues(alpha: 0.32),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: LambeIconWidget(
                        iconStr: cat.iconUrl,
                        size: 24,
                        imageSize: 50,
                        imageFit: BoxFit.cover,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  // Tên dịch vụ bên dưới nằm trực tiếp trên nền màn hình
                  Text(
                    cat.name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurface,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}
