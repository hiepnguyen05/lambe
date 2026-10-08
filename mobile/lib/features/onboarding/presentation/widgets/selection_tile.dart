import 'package:flutter/material.dart';

import 'onboarding_icon_widget.dart';

class SelectionTile extends StatelessWidget {
  final String title;
  final bool isSelected;
  final VoidCallback onTap;
  final IconData? icon;
  final String? iconUrl;
  final bool isCheckbox;

  const SelectionTile({
    super.key,
    required this.title,
    required this.isSelected,
    required this.onTap,
    this.icon,
    this.iconUrl,
    this.isCheckbox = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF005C55).withValues(alpha: 0.05)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF005C55)
                : const Color(0xFFBDC9C6).withValues(alpha: 0.3),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            if (iconUrl != null && iconUrl!.isNotEmpty) ...[
              OnboardingIconWidget(
                iconStr: iconUrl,
                size: 24,
                color: isSelected
                    ? const Color(0xFF005C55)
                    : const Color(0xFF72817F),
              ),
              const SizedBox(width: 16),
            ] else if (icon != null) ...[
              Icon(
                icon,
                color: isSelected
                    ? const Color(0xFF005C55)
                    : const Color(0xFF72817F),
              ),
              const SizedBox(width: 16),
            ],
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 16,
                  color: isSelected
                      ? const Color(0xFF005C55)
                      : const Color(0xFF0B1C30),
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (isCheckbox)
              Icon(
                isSelected ? Icons.check_circle : Icons.circle_outlined,
                color: isSelected
                    ? const Color(0xFF005C55)
                    : const Color(0xFFBDC9C6),
              ),
          ],
        ),
      ),
    );
  }
}
