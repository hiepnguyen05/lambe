import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/booking_candidates_provider.dart';

class SelectProviderFilterBar extends ConsumerWidget {
  const SelectProviderFilterBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(candidateFilterProvider);
    final notifier = ref.read(candidateFilterProvider.notifier);

    const tabs = [
      (CandidateSortOption.nearest, 'Gần nhất', Icons.near_me_rounded),
      (CandidateSortOption.highestRated, 'Sao', Icons.star_rounded),
      (CandidateSortOption.priceAsc, 'Giá thấp', Icons.arrow_downward_rounded),
      (CandidateSortOption.priceDesc, 'Giá cao', Icons.arrow_upward_rounded),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: tabs.map((tab) {
            final option = tab.$1;
            final label = tab.$2;
            final icon = tab.$3;
            final isSelected = filter.sortOption == option;

            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _buildSortTabChip(
                icon: icon,
                label: label,
                isSelected: isSelected,
                onTap: () => notifier.setSortOption(option),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSortTabChip({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    const primaryTeal = Color(0xFF0F766E);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? primaryTeal : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(100),
          border: Border.all(
            color: isSelected ? primaryTeal : const Color(0xFFCBD5E1),
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: primaryTeal.withValues(alpha: 0.2),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: isSelected
                  ? Colors.white
                  : (icon == Icons.star_rounded
                      ? const Color(0xFFF59E0B)
                      : const Color(0xFF64748B)),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
