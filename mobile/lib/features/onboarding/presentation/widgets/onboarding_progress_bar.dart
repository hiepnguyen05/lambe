import 'package:flutter/material.dart';

class OnboardingProgressBar extends StatelessWidget {
  final int totalPages;
  final int currentPage;

  const OnboardingProgressBar({
    super.key,
    required this.totalPages,
    required this.currentPage,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
      child: Row(
        children: List.generate(totalPages, (index) {
          return Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 4.0),
              height: 4,
              decoration: BoxDecoration(
                color: index <= currentPage
                    ? const Color(0xFF0F766E)
                    : const Color(0xFFBDC9C6).withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }
}
