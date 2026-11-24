import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../providers/recent_searches_provider.dart';

class ExploreRecentSearchesCard extends ConsumerWidget {
  final ValueChanged<String> onSelect;

  const ExploreRecentSearchesCard({
    super.key,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recentSearches = ref.watch(recentSearchesProvider);
    if (recentSearches.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(14), // p-3.5
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest, // bg-surface-container-lowest
        borderRadius: BorderRadius.circular(12), // rounded-xl
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryContainer.withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header: Tiêu đề + Nút Xóa lịch sử (flex items-center justify-between mb-2.5)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.history_rounded,
                    size: 18,
                    color: AppColors.outline, // text-outline
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Tìm kiếm gần đây',
                    style: TextStyle(
                      fontSize: 14, // font-label-lg
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurface,
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () {
                  ref.read(recentSearchesProvider.notifier).clearAll();
                },
                borderRadius: BorderRadius.circular(4),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text(
                    'Xóa lịch sử',
                    style: TextStyle(
                      fontSize: 11, // font-label-sm
                      fontWeight: FontWeight.w500,
                      color: AppColors.outline,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10), // mb-2.5

          // Danh sách các tag (flex flex-wrap gap-2)
          Wrap(
            spacing: 8, // gap-2
            runSpacing: 8,
            children: recentSearches.map((query) {
              final isPersonTag = query.contains('(') || query.contains('Anh');

              return Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => onSelect(query),
                  borderRadius: BorderRadius.circular(8), // rounded-lg
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12, // px-3
                      vertical: 6,    // py-1.5
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow, // bg-surface-container-low
                      borderRadius: BorderRadius.circular(8), // rounded-lg
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (isPersonTag) ...[
                          const Icon(
                            Icons.person_rounded,
                            size: 14,
                            color: AppColors.primary, // text-primary
                          ),
                          const SizedBox(width: 6),
                        ],
                        Text(
                          query,
                          style: const TextStyle(
                            fontSize: 12, // font-body-sm
                            fontWeight: FontWeight.w400,
                            color: AppColors.onSurfaceVariant, // text-on-surface-variant
                          ),
                        ),
                        if (!isPersonTag) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 14,
                            color: AppColors.outline, // text-outline
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
