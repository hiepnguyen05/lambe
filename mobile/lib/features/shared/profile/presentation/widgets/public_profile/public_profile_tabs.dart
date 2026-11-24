import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class PublicProfileTabs extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTabSelected;
  final int? servicesCount;
  final int? portfolioCount;
  final int? reviewsCount;
  final bool showTeamTab;

  const PublicProfileTabs({
    super.key,
    required this.selectedIndex,
    required this.onTabSelected,
    this.servicesCount,
    this.portfolioCount,
    this.reviewsCount,
    this.showTeamTab = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.35),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildTabItem(
              index: 0,
              title: 'Giới thiệu',
              count: servicesCount,
            ),
          ),
          Expanded(
            child: _buildTabItem(
              index: 1,
              title: 'Nhật ký',
              count: portfolioCount,
            ),
          ),
          Expanded(
            child: _buildTabItem(
              index: 2,
              title: 'Đánh giá',
              count: reviewsCount,
            ),
          ),
          if (showTeamTab)
            Expanded(
              child: _buildTabItem(
                index: 3,
                title: 'Đội ngũ',
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTabItem({
    required int index,
    required String title,
    int? count,
  }) {
    final isSelected = selectedIndex == index;

    return GestureDetector(
      onTap: () => onTabSelected(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(100),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.28),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                  color: isSelected ? Colors.white : AppColors.onSurfaceVariant,
                ),
              ),
              if (count != null && count > 0) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? Colors.white.withValues(alpha: 0.22)
                        : AppColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: isSelected ? Colors.white : AppColors.primary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
