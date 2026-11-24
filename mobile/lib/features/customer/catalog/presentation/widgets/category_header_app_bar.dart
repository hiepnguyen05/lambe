import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

/// Header App Bar kính mờ dành riêng cho màn hình Danh Sách Dịch Vụ ([CategoryServicesScreen]).
/// Thiết kế chuẩn 100% theo mẫu HTML: Nút Back tròn, Logo Lambe, Tiêu đề "Danh Sách Dịch Vụ"
/// và các action bên phải: Tìm kiếm, Chia sẻ, Avatar người dùng.
class CategoryHeaderAppBar extends ConsumerWidget {
  final VoidCallback? onBackTap;
  final VoidCallback? onSearchTap;
  final VoidCallback? onShareTap;
  final VoidCallback? onProfileTap;

  const CategoryHeaderAppBar({
    super.key,
    this.onBackTap,
    this.onSearchTap,
    this.onShareTap,
    this.onProfileTap,
  });

  static const String _defaultTemplateAvatar =
      'https://lh3.googleusercontent.com/aida/AEtjO1XlDd36RzoNRw4CmBrXfYundsk_XsJ64LHBE_8HRWUUWz2FCiRs0eNNiIJiUe3ajWKXWgfshyY2q1mO0kaTYT6Mhj9NFdYzk7yanpouV-QOh1DIXzLlUaLaQd2yq9PwpwYx_yyLFTRuxLIJF1g-FCnC_OzrAJ2SA0tqTRr8CUt4dohrCoG2usAKNUJw_VGPSZEoJ4RxrAGLhl880UzL-PSws4MiBu-BEg3yO6xNW204pJ4ikZmphMwuCQ';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final resolvedAvatar =
        (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
        ? user.avatarUrl!
        : _defaultTemplateAvatar;

    return SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: AppColors.surface.withValues(alpha: 0.85),
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      toolbarHeight: 64,
      automaticallyImplyLeading: false,
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface.withValues(alpha: 0.85),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
          ),
        ),
      ),
      title: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // 1. Bên trái: Nút Quay lại + Logo Lambe + Tiêu đề
          Expanded(
            child: Row(
              children: [
                // Nút quay lại tròn (w-11 h-11 flex items-center justify-center rounded-full)
                InkWell(
                  onTap:
                      onBackTap ??
                      () {
                        if (Navigator.of(context).canPop()) {
                          context.pop();
                        } else {
                          context.go('/home');
                        }
                      },
                  borderRadius: BorderRadius.circular(100),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow.withValues(
                        alpha: 0.5,
                      ),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.arrow_back_rounded,
                      size: 22,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Logo Lambe thương hiệu chuẩn (h-8 w-auto object-contain)
                Container(
                  width: 32,
                  height: 32,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.outlineVariant.withValues(alpha: 0.35),
                    ),
                  ),
                  child: SvgPicture.asset(
                    'assets/images/logo.svg',
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(width: 8),

                // Tiêu đề: Danh Sách Dịch Vụ (font-headline-sm 18px w600 truncate)
                const Flexible(
                  child: Text(
                    'Danh Sách Dịch Vụ',
                    style: TextStyle(
                      fontSize: 18, // font-headline-sm (18px)
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurface, // #0B1C30
                      letterSpacing: -0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          // 2. Bên phải: Nút Tìm kiếm, Chia sẻ, Avatar người dùng
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Nút Tìm kiếm nhanh
              InkWell(
                onTap: onSearchTap,
                borderRadius: BorderRadius.circular(100),
                child: const SizedBox(
                  width: 38,
                  height: 38,
                  child: Icon(
                    Icons.search_rounded,
                    size: 22,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ),

              // Nút Chia sẻ
              InkWell(
                onTap: onShareTap,
                borderRadius: BorderRadius.circular(100),
                child: const SizedBox(
                  width: 38,
                  height: 38,
                  child: Icon(
                    Icons.share_rounded,
                    size: 20,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(width: 4),

              // Avatar người dùng tròn 32x32 (w-8 h-8 rounded-full)
              InkWell(
                onTap: onProfileTap ?? () => context.push('/profile'),
                borderRadius: BorderRadius.circular(100),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.outlineVariant.withValues(alpha: 0.35),
                      width: 1.2,
                    ),
                  ),
                  child: ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: resolvedAvatar,
                      width: 32,
                      height: 32,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: AppColors.surfaceContainerHigh,
                        child: const Icon(
                          Icons.person,
                          size: 18,
                          color: AppColors.primaryContainer,
                        ),
                      ),
                      errorWidget: (_, __, ___) => Container(
                        color: AppColors.surfaceContainerHigh,
                        child: const Icon(
                          Icons.person,
                          size: 18,
                          color: AppColors.primaryContainer,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
