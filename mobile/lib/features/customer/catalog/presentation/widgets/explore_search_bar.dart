import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class ExploreSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final VoidCallback? onFilterTap;
  final VoidCallback? onSubmitted;
  final bool hasActiveFilter;
  final String hintText;

  const ExploreSearchBar({
    super.key,
    required this.controller,
    this.onChanged,
    this.onClear,
    this.onFilterTap,
    this.onSubmitted,
    this.hasActiveFilter = false,
    this.hintText = 'Tìm dịch vụ, thợ tóc, spa gần bạn...',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 42,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.45),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(
            Icons.search_rounded,
            size: 18,
            color: AppColors.primaryContainer,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, value, _) {
                return TextField(
                  controller: controller,
                  onChanged: onChanged,
                  onSubmitted: (_) => onSubmitted?.call(),
                  textInputAction: TextInputAction.search,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w500,
                  ),
                  decoration: InputDecoration(
                    hintText: hintText,
                    hintStyle: const TextStyle(
                      fontSize: 13.5,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w400,
                    ),
                    isDense: true,
                    filled: false,
                    fillColor: Colors.transparent,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                );
              },
            ),
          ),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) {
              if (value.text.isEmpty) {
                return const SizedBox.shrink();
              }
              return IconButton(
                icon: const Icon(
                  Icons.cancel_rounded,
                  size: 19,
                  color: AppColors.outline,
                ),
                onPressed: onClear,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                splashRadius: 18,
              );
            },
          ),
          Container(
            width: 1,
            height: 20,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            color: AppColors.outlineVariant.withValues(alpha: 0.5),
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: Icon(
                  Icons.tune_rounded,
                  size: 20,
                  color: hasActiveFilter
                      ? AppColors.primaryContainer
                      : AppColors.onSurfaceVariant,
                ),
                onPressed: onFilterTap,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                splashRadius: 20,
              ),
              if (hasActiveFilter)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: AppColors.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }
}
