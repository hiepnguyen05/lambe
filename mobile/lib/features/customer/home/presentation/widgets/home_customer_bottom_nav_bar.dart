import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/chat/di/chat_providers.dart';

class HomeCustomerBottomNavBar extends ConsumerWidget {
  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  const HomeCustomerBottomNavBar({
    super.key,
    this.currentIndex = 0,
    required this.onTabSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadMessagesCount = ref.watch(
      chatInboxNotifierProvider('customer').select((s) => s.totalUnreadCount),
    );

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface.withValues(alpha: 0.92),
            border: Border(
              top: BorderSide(
                color: AppColors.surfaceContainerHighest.withValues(alpha: 0.5),
                width: 1,
              ),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0F0F766E),
                blurRadius: 12,
                offset: Offset(0, -2),
              ),
            ],
          ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                index: 0,
                icon: Icons.home_rounded,
                label: 'Trang chủ',
              ),
              _buildNavItem(
                index: 1,
                icon: Icons.calendar_month_rounded,
                label: 'Lịch hẹn',
              ),
              _buildNavItem(
                index: 2,
                icon: Icons.explore_rounded,
                label: 'Khám phá',
              ),
              _buildNavItem(
                index: 3,
                icon: Icons.chat_bubble_rounded,
                label: 'Tin nhắn',
                badgeCount: unreadMessagesCount,
              ),
              _buildNavItem(
                index: 4,
                icon: Icons.person_rounded,
                label: 'Tài khoản',
              ),
            ],
          ),
        ),
      ),
    ),
  ),
);
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required String label,
    int badgeCount = 0,
  }) {
    final isSelected = currentIndex == index;

    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => onTabSelected(index),
          splashColor: AppColors.primary.withValues(alpha: 0.1),
          highlightColor: Colors.transparent,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary.withValues(alpha: 0.12)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: badgeCount > 0
                    ? Badge.count(
                        count: badgeCount,
                        backgroundColor: const Color(0xFF0F766E),
                        textColor: Colors.white,
                        child: Icon(
                          icon,
                          size: 22,
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.outline,
                        ),
                      )
                    : Icon(
                        icon,
                        size: 22,
                        color: isSelected
                            ? AppColors.primary
                            : AppColors.outline,
                      ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? AppColors.primary : AppColors.outline,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
