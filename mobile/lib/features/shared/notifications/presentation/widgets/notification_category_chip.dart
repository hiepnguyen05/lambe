import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/app_notification_entity.dart';
import '../providers/notifications_providers.dart';

class NotificationCategoryBar extends ConsumerWidget {
  const NotificationCategoryBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(selectedNotificationCategoryProvider);

    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: NotificationCategory.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = NotificationCategory.values[index];
          final isSelected = category == selected;
          final unreadCount = ref.watch(
            unreadCountByCategoryProvider(category),
          );

          return _CategoryChip(
            category: category,
            isSelected: isSelected,
            unreadCount: unreadCount,
            onTap: () {
              ref.read(selectedNotificationCategoryProvider.notifier).state =
                  category;
            },
          );
        },
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final NotificationCategory category;
  final bool isSelected;
  final int unreadCount;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.category,
    required this.isSelected,
    required this.unreadCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final IconData icon = switch (category) {
      NotificationCategory.all => Icons.all_inbox_rounded,
      NotificationCategory.order => Icons.receipt_long_rounded,
      NotificationCategory.promotion => Icons.local_offer_rounded,
      NotificationCategory.system => Icons.campaign_rounded,
    };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary
              : AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : AppColors.outlineVariant.withValues(alpha: 0.5),
            width: 1.2,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? Colors.white : AppColors.onSurfaceVariant,
            ),
            const SizedBox(width: 6),
            Text(
              category.label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : AppColors.onSurface,
              ),
            ),
            if (unreadCount > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 1.5,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : const Color(0xFFDC2626),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  unreadCount > 99 ? '99+' : '$unreadCount',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? AppColors.primary : Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
