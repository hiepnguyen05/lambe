import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class HomePersonalizationSection extends StatelessWidget {
  final String userName;
  final ValueChanged<String>? onSearchChanged;
  final VoidCallback? onFilterTap;
  final VoidCallback? onSearchTap;

  const HomePersonalizationSection({
    super.key,
    required this.userName,
    this.onSearchChanged,
    this.onFilterTap,
    this.onSearchTap,
  });

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 11) return 'Chào buổi sáng';
    if (hour >= 11 && hour < 14) return 'Chào buổi trưa';
    if (hour >= 14 && hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Greeting & Subtitle
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${_getGreeting()}, $userName 👋',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: AppColors.onSurface,
                letterSpacing: -0.2,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 3),
            const Text(
              'Hôm nay bạn muốn đặt dịch vụ làm đẹp nào?',
              style: TextStyle(
                fontSize: 12.5,
                color: AppColors.textMuted,
                fontWeight: FontWeight.normal,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Pill-shaped Search Bar with embedded Tune Filter Button
        Container(
          height: 48,
          clipBehavior: Clip.antiAlias,
          padding: const EdgeInsets.only(left: 16, right: 6),
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(9999),
            border: Border.all(
              color: AppColors.surfaceContainerHighest.withValues(alpha: 0.35),
              width: 1,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A0F766E),
                blurRadius: 12,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(
                Icons.search_rounded,
                color: AppColors.outline,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  readOnly: onSearchTap != null && onSearchChanged == null,
                  onChanged: onSearchChanged,
                  onTap: onSearchTap,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.onSurface,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    fillColor: Colors.transparent,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    hintText: 'Tìm dịch vụ, chuyên gia làm đẹp gần bạn...',
                    hintStyle: TextStyle(
                      color: AppColors.outline.withValues(alpha: 0.7),
                      fontSize: 13,
                    ),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              // Nút bộ lọc (Tune) tròn bên trong thanh tìm kiếm
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onFilterTap,
                  borderRadius: BorderRadius.circular(9999),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: AppColors.surfaceContainer,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.tune_rounded,
                      color: AppColors.onSurfaceVariant,
                      size: 18,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
