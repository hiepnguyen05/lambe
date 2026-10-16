import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class HomePersonalizationSection extends StatelessWidget {
  final String userName;
  final String? addressLine;
  final int? onlineSpecialistsCount;
  final VoidCallback? onLocationTap;
  final ValueChanged<String>? onSearchChanged;
  final VoidCallback? onFilterTap;

  const HomePersonalizationSection({
    super.key,
    required this.userName,
    this.addressLine,
    this.onlineSpecialistsCount,
    this.onLocationTap,
    this.onSearchChanged,
    this.onFilterTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasAddress = addressLine != null && addressLine!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Top Greeting & Location
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Greeting & Address
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          'Xin chào, $userName',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                            color: AppColors.onSurface,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        '✨',
                        style: TextStyle(fontSize: 16),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  InkWell(
                    onTap: onLocationTap,
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.location_on,
                            size: 15,
                            color: hasAddress ? AppColors.primary : AppColors.outline,
                          ),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                              hasAddress
                                  ? addressLine!
                                  : 'Thêm địa chỉ nhận dịch vụ...',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: hasAddress
                                    ? AppColors.onSurfaceVariant
                                    : AppColors.outline,
                                fontSize: 12,
                                fontWeight: hasAddress
                                    ? FontWeight.w500
                                    : FontWeight.normal,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 15,
                            color: AppColors.outlineVariant,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (onlineSpecialistsCount != null && onlineSpecialistsCount! > 0) ...[
              const SizedBox(width: 8),
              // Online specialists badge (chỉ hiển thị khi có dữ liệu thật)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '$onlineSpecialistsCount chuyên viên online',
                      style: theme.textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                        fontSize: 10.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 14),

        // Search Bar & Filter Button
        Row(
          children: [
            Expanded(
              child: Container(
                height: 46,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(100),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.search_rounded,
                      color: AppColors.outline,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        onChanged: onSearchChanged,
                        style: const TextStyle(fontSize: 13),
                        decoration: const InputDecoration(
                          hintText: 'Tìm dịch vụ, chuyên gia làm đẹp gần bạn...',
                          hintStyle: TextStyle(
                            color: AppColors.outline,
                            fontSize: 13,
                          ),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Nút bộ lọc (Filter)
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: IconButton(
                onPressed: onFilterTap,
                icon: const Icon(
                  Icons.tune_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
