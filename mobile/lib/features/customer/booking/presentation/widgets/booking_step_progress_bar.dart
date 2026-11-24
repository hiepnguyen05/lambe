import 'package:flutter/material.dart';

class BookingStepProgressBar extends StatelessWidget
    implements PreferredSizeWidget {
  final int currentStep; // 1: Dịch vụ, 2: Chuyên viên, 3: Xác nhận

  const BookingStepProgressBar({super.key, required this.currentStep});

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0F766E);
    const completedColor = Color(0xFF0F766E);
    const inactiveColor = Color(0xFFE2E8F0);
    const inactiveTextColor = Color(0xFF94A3B8);

    return Container(
      height: 64,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1.2),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Background Connecting Lines
          Positioned(
            top: 11,
            left: 28,
            right: 28,
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 2.5,
                    decoration: BoxDecoration(
                      color: currentStep >= 2 ? completedColor : inactiveColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    height: 2.5,
                    decoration: BoxDecoration(
                      color: currentStep >= 3 ? completedColor : inactiveColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Foreground Steps
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStepItem(
                step: 1,
                label: 'Dịch vụ',
                primaryColor: primaryColor,
                inactiveColor: inactiveColor,
                inactiveTextColor: inactiveTextColor,
              ),
              _buildStepItem(
                step: 2,
                label: 'Chuyên viên',
                primaryColor: primaryColor,
                inactiveColor: inactiveColor,
                inactiveTextColor: inactiveTextColor,
              ),
              _buildStepItem(
                step: 3,
                label: 'Xác nhận',
                primaryColor: primaryColor,
                inactiveColor: inactiveColor,
                inactiveTextColor: inactiveTextColor,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepItem({
    required int step,
    required String label,
    required Color primaryColor,
    required Color inactiveColor,
    required Color inactiveTextColor,
  }) {
    final isCompleted = currentStep > step;
    final isCurrent = currentStep == step;

    Color badgeBg;
    Widget badgeContent;
    BoxBorder? border;
    List<BoxShadow>? shadows;

    if (isCompleted) {
      badgeBg = primaryColor;
      border = Border.all(color: Colors.white, width: 2);
      badgeContent = const Icon(
        Icons.check_rounded,
        size: 13,
        color: Colors.white,
      );
    } else if (isCurrent) {
      badgeBg = primaryColor;
      border = Border.all(color: Colors.white, width: 1.8);
      shadows = [
        BoxShadow(
          color: primaryColor.withValues(alpha: 0.3),
          blurRadius: 6,
          offset: const Offset(0, 2),
        ),
      ];
      badgeContent = Text(
        '$step',
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      );
    } else {
      badgeBg = const Color(0xFFF8FAFC);
      border = Border.all(color: inactiveColor, width: 1.2);
      badgeContent = Text(
        '$step',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: inactiveTextColor,
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: badgeBg,
            shape: BoxShape.circle,
            border: border,
            boxShadow: shadows,
          ),
          alignment: Alignment.center,
          child: badgeContent,
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isCurrent
                ? FontWeight.w700
                : (isCompleted ? FontWeight.w600 : FontWeight.w500),
            color: isCurrent
                ? primaryColor
                : (isCompleted ? const Color(0xFF334155) : inactiveTextColor),
          ),
        ),
      ],
    );
  }
}
