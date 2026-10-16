import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import 'home_specialist_card.dart';

class HomeFeaturedSpecialistsSection extends StatelessWidget {
  final List<SpecialistItem> specialists;
  final VoidCallback? onSeeMoreTap;
  final ValueChanged<SpecialistItem>? onSpecialistTap;
  final ValueChanged<SpecialistItem>? onBookTap;

  const HomeFeaturedSpecialistsSection({
    super.key,
    this.specialists = const [],
    this.onSeeMoreTap,
    this.onSpecialistTap,
    this.onBookTap,
  });

  @override
  Widget build(BuildContext context) {
    // Không mock dữ liệu: Nếu chưa có dữ liệu từ API thật thì để trống theo yêu cầu của user
    if (specialists.isEmpty) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Chuyên gia quanh bạn',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      fontSize: 16.5,
                      color: AppColors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Được tuyển chọn & kiểm định tay nghề nghiêm ngặt',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.onSurfaceVariant,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            InkWell(
              onTap: onSeeMoreTap,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Row(
                  children: [
                    Text(
                      'Xem thêm',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // List of specialists from real data
        ...specialists.map((specialist) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: HomeSpecialistCard(
              specialist: specialist,
              onCardTap: () => onSpecialistTap?.call(specialist),
              onBookTap: () => onBookTap?.call(specialist),
            ),
          );
        }),
      ],
    );
  }
}
