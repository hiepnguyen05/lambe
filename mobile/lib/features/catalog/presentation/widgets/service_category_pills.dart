import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/lambe_icon_widget.dart';
import '../../../home/presentation/providers/home_categories_provider.dart';

class ServiceCategoryPills extends ConsumerStatefulWidget {
  final String? selectedSlug;
  final void Function(String? slug, String name) onSelectCategory;

  const ServiceCategoryPills({
    super.key,
    required this.selectedSlug,
    required this.onSelectCategory,
  });

  @override
  ConsumerState<ServiceCategoryPills> createState() =>
      _ServiceCategoryPillsState();
}

class _ServiceCategoryPillsState extends ConsumerState<ServiceCategoryPills> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Kết nối trực tiếp API categories thật
    final categoriesAsync = ref.watch(homeCategoriesProvider);

    return categoriesAsync.when(
      data: (categories) {
        return SizedBox(
          height: 38,
          child: ListView.separated(
            controller: _scrollController,
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: categories.length + 1, // +1 cho tab "Tất cả"
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              if (index == 0) {
                final isSelected =
                    widget.selectedSlug == null || widget.selectedSlug!.isEmpty;
                return _buildPill(
                  label: 'Tất cả',
                  icon: Icon(
                    Icons.auto_awesome_rounded,
                    size: 15,
                    color: isSelected ? Colors.white : const Color(0xFF0F766E),
                  ),
                  isSelected: isSelected,
                  onTap: () => widget.onSelectCategory(null, 'Tất cả dịch vụ'),
                );
              }

              final category = categories[index - 1];
              final isSelected = widget.selectedSlug == category.slug;

              return _buildPill(
                label: category.name,
                icon: LambeIconWidget(
                  iconStr: category.iconUrl,
                  size: 15,
                  color: isSelected ? Colors.white : const Color(0xFF0F766E),
                  fallbackIcon: Icons.spa_rounded,
                ),
                isSelected: isSelected,
                onTap: () => widget.onSelectCategory(category.slug, category.name),
              );
            },
          ),
        );
      },
      loading: () => const SizedBox(
        height: 38,
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Color(0xFF0F766E),
            ),
          ),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  Widget _buildPill({
    required String label,
    required Widget icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0F766E) : Colors.white,
            borderRadius: BorderRadius.circular(100),
            border: Border.all(
              color: isSelected
                  ? Colors.transparent
                  : const Color(0xFFE2E8F0).withValues(alpha: 0.8),
              width: 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(0xFF0F766E).withValues(alpha: 0.25),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 2,
                      offset: const Offset(0, 1),
                    ),
                  ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              icon,
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
