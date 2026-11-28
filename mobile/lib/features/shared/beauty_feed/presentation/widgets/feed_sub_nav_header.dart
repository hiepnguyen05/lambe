import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/customer/home/presentation/providers/home_categories_provider.dart';

import '../../domain/feed_scope.dart';

class FeedSubNavHeader extends ConsumerWidget {
  final FeedMode selectedMode;
  final ValueChanged<FeedMode> onModeChanged;
  final String? selectedCategorySlug;
  final ValueChanged<String?> onCategoryChanged;
  final bool? showSaved;
  final bool? showMine;
  final bool showSavedAndMine;
  final bool showBackButton;
  final VoidCallback? onBackTap;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onComposeTap;
  final VoidCallback? onSearchTap;
  final bool searchExpanded;
  final TextEditingController? searchController;
  final ValueChanged<String>? onSearchChanged;
  final ValueChanged<String>? onSearchSubmitted;
  final VoidCallback? onSearchClosed;

  const FeedSubNavHeader({
    super.key,
    required this.selectedMode,
    required this.onModeChanged,
    this.selectedCategorySlug,
    required this.onCategoryChanged,
    this.showSaved,
    this.showMine,
    this.showSavedAndMine = false,
    this.showBackButton = false,
    this.onBackTap,
    this.onNotificationTap,
    this.onComposeTap,
    this.onSearchTap,
    this.searchExpanded = false,
    this.searchController,
    this.onSearchChanged,
    this.onSearchSubmitted,
    this.onSearchClosed,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(homeCategoriesProvider);
    final categories = categoriesAsync.valueOrNull ?? [];
    final effectiveShowSaved = showSaved ?? showSavedAndMine;
    final effectiveShowMine = showMine ?? showSavedAndMine;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(
          bottom: BorderSide(
            color: AppColors.surfaceContainerHigh.withValues(alpha: 0.6),
            width: 0.8,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Top row: inline Feed Search bar when expanded, otherwise tabs + actions
          if (searchExpanded)
            _buildSearchRow(context)
          else
            Row(
              children: [
                if (showBackButton)
                  IconButton(
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 18,
                    ),
                    onPressed: onBackTap,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                    tooltip: 'Quay lại',
                  )
                else
                  const SizedBox(width: 4),

                // Navigation Tabs with layout constraints & strict boundary clipping
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final tabGap = (effectiveShowSaved || effectiveShowMine)
                          ? 12.0
                          : 18.0;
                      return SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        clipBehavior: Clip.hardEdge,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minWidth: constraints.maxWidth,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _buildTikTokTab(
                                context,
                                title: 'Khám phá',
                                isSelected: selectedMode == FeedMode.all,
                                onTap: () => onModeChanged(FeedMode.all),
                              ),
                              SizedBox(width: tabGap),
                              _buildTikTokTab(
                                context,
                                title: 'Đang theo dõi',
                                isSelected: selectedMode == FeedMode.following,
                                onTap: () => onModeChanged(FeedMode.following),
                              ),
                              if (effectiveShowSaved) ...[
                                SizedBox(width: tabGap),
                                _buildTikTokTab(
                                  context,
                                  title: 'Đã lưu',
                                  isSelected: selectedMode == FeedMode.saved,
                                  onTap: () => onModeChanged(FeedMode.saved),
                                ),
                              ],
                              if (effectiveShowMine) ...[
                                SizedBox(width: tabGap),
                                _buildTikTokTab(
                                  context,
                                  title: 'Của tôi',
                                  isSelected: selectedMode == FeedMode.mine,
                                  onTap: () => onModeChanged(FeedMode.mine),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Search Button
                if (onSearchTap != null)
                  IconButton(
                    icon: const Icon(
                      Icons.search_rounded,
                      size: 21,
                      color: AppColors.onSurface,
                    ),
                    onPressed: onSearchTap,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 34,
                      minHeight: 34,
                    ),
                    tooltip: 'Tìm kiếm bảng tin',
                  ),

                // Compose Button (for Provider) or Notification Button
                if (onComposeTap != null)
                  IconButton(
                    icon: const Icon(
                      Icons.edit_square,
                      size: 19,
                      color: AppColors.primary,
                    ),
                    onPressed: onComposeTap,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 34,
                      minHeight: 34,
                    ),
                    tooltip: 'Tạo bài viết',
                  )
                else if (onNotificationTap != null)
                  IconButton(
                    icon: const Icon(
                      Icons.notifications_none_rounded,
                      size: 21,
                      color: AppColors.onSurface,
                    ),
                    onPressed: onNotificationTap,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 34,
                      minHeight: 34,
                    ),
                    tooltip: 'Thông báo',
                  ),
              ],
            ),
          const SizedBox(height: 8),

          // 2. Category Filter Chips (Horizontal Scroll)
          SizedBox(
            height: 32,
            child: ListView(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              children: [
                // "Tất cả" chip
                _buildFilterChip(
                  label: 'Tất cả',
                  isSelected: selectedCategorySlug == null,
                  onTap: () => onCategoryChanged(null),
                ),
                const SizedBox(width: 8),

                // Dynamic category chips from GET /categories
                for (final cat in categories) ...[
                  _buildFilterChip(
                    label: cat.name,
                    isSelected: selectedCategorySlug == cat.slug,
                    onTap: () => onCategoryChanged(
                      selectedCategorySlug == cat.slug ? null : cat.slug,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchRow(BuildContext context) {
    final controller = searchController;
    return SizedBox(
      height: 40,
      child: Row(
        children: [
          if (showBackButton)
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
              onPressed: onBackTap,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              tooltip: 'Quay lại',
            ),
          Expanded(
            child: Container(
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(100),
              ),
              child: TextField(
                controller: controller,
                autofocus: true,
                textInputAction: TextInputAction.search,
                onChanged: onSearchChanged,
                onSubmitted: onSearchSubmitted,
                style: const TextStyle(
                  fontSize: 13.5,
                  color: AppColors.onSurface,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  hintText: 'Tìm bài viết, chuyên viên, dịch vụ...',
                  hintStyle: TextStyle(
                    fontSize: 13,
                    color: AppColors.onSurfaceVariant.withValues(alpha: 0.7),
                  ),
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    size: 18,
                    color: AppColors.onSurfaceVariant,
                  ),
                  prefixIconConstraints: const BoxConstraints(
                    minWidth: 36,
                    minHeight: 36,
                  ),
                  suffixIcon: controller == null
                      ? null
                      : ValueListenableBuilder<TextEditingValue>(
                          valueListenable: controller,
                          builder: (_, value, _) {
                            if (value.text.isEmpty) {
                              return const SizedBox.shrink();
                            }
                            return IconButton(
                              icon: const Icon(
                                Icons.clear_rounded,
                                size: 17,
                                color: AppColors.onSurfaceVariant,
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                minWidth: 32,
                                minHeight: 32,
                              ),
                              tooltip: 'Xóa từ khóa',
                              onPressed: () {
                                controller.clear();
                                onSearchChanged?.call('');
                              },
                            );
                          },
                        ),
                ),
              ),
            ),
          ),
          TextButton(
            onPressed: onSearchClosed,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(0, 34),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              'Đóng',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTikTokTab(
    BuildContext context, {
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeInOut,
              style: TextStyle(
                fontSize: isSelected ? 15 : 13.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? AppColors.onSurface
                    : AppColors.onSurfaceVariant.withValues(alpha: 0.65),
                letterSpacing: -0.2,
              ),
              child: Text(title),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              height: 2.5,
              width: isSelected ? 20 : 0,
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(100),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(100),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? Colors.white : AppColors.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}
