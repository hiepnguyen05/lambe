import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ServiceAudienceFilter extends StatelessWidget {
  final String? selectedAudience;
  final ValueChanged<String?> onSelectAudience;
  final int? selectedMaxPrice;
  final VoidCallback onOpenPriceFilter;

  const ServiceAudienceFilter({
    super.key,
    required this.selectedAudience,
    required this.onSelectAudience,
    required this.selectedMaxPrice,
    required this.onOpenPriceFilter,
  });

  @override
  Widget build(BuildContext context) {
    final audience = selectedAudience?.toUpperCase() ?? 'ALL';

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // 1. Nút mở bộ lọc giá
          InkWell(
            onTap: onOpenPriceFilter,
            borderRadius: BorderRadius.circular(100),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: selectedMaxPrice != null && selectedMaxPrice! > 0
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(100),
                border: Border.all(
                  color: selectedMaxPrice != null && selectedMaxPrice! > 0
                      ? AppColors.primary
                      : AppColors.surfaceContainerHigh,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.tune_rounded,
                    size: 14,
                    color: selectedMaxPrice != null && selectedMaxPrice! > 0
                        ? AppColors.primary
                        : AppColors.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    selectedMaxPrice != null && selectedMaxPrice! > 0
                        ? '≤ ${(selectedMaxPrice! / 1000).toStringAsFixed(0)}k'
                        : 'Mức giá',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: selectedMaxPrice != null && selectedMaxPrice! > 0
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: selectedMaxPrice != null && selectedMaxPrice! > 0
                          ? AppColors.primary
                          : AppColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),

          // 2. Chip: Tất cả
          _buildChip(
            label: 'Mọi người',
            isSelected: audience == 'ALL' || audience.isEmpty,
            onTap: () => onSelectAudience('ALL'),
          ),
          const SizedBox(width: 6),

          // 3. Chip: Nữ
          _buildChip(
            label: 'Nữ giới 👧',
            isSelected: audience == 'FEMALE' || audience == 'WOMEN',
            onTap: () => onSelectAudience('FEMALE'),
          ),
          const SizedBox(width: 6),

          // 4. Chip: Nam
          _buildChip(
            label: 'Nam giới 👦',
            isSelected: audience == 'MALE' || audience == 'MEN',
            onTap: () => onSelectAudience('MALE'),
          ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.12)
              : AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.surfaceContainerHigh,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? AppColors.primary : AppColors.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
