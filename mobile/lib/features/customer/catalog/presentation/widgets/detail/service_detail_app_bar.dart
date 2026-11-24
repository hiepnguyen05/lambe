import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

/// Header App Bar kính mờ chuẩn 100% theo mẫu HTML cho màn hình Chi Tiết Dịch Vụ:
/// Nút Back tròn 44x44, Logo Lambe, Tiêu đề "Chi Tiết Dịch Vụ",
/// các nút hành động bên phải: Chia sẻ, Yêu thích, và Avatar người dùng.
class ServiceDetailAppBar extends ConsumerStatefulWidget
    implements PreferredSizeWidget {
  final String title;
  final String? avatarUrl;
  final VoidCallback? onShare;
  final VoidCallback? onFavorite;

  const ServiceDetailAppBar({
    super.key,
    this.title = 'Chi Tiết Dịch Vụ',
    this.avatarUrl,
    this.onShare,
    this.onFavorite,
  });

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  ConsumerState<ServiceDetailAppBar> createState() => _ServiceDetailAppBarState();
}

class _ServiceDetailAppBarState extends ConsumerState<ServiceDetailAppBar> {
  bool _isFavorite = false;

  @override
  Widget build(BuildContext context) {
    String? avatarUrl = widget.avatarUrl;
    if (avatarUrl == null) {
      try {
        final user = ref.watch(authNotifierProvider).valueOrNull;
        avatarUrl = user?.avatarUrl;
      } catch (_) {
        // Fallback safely if auth provider or Firebase is uninitialized
      }
    }

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface.withValues(alpha: 0.85),
            border: Border(
              bottom: BorderSide(
                color: AppColors.surfaceContainerHighest.withValues(alpha: 0.35),
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  // 1. Bên trái: Nút Quay lại tròn (w-11 h-11) + Logo Lambe
                  InkWell(
                    onTap: () {
                      if (Navigator.of(context).canPop()) {
                        context.pop();
                      } else {
                        context.go('/services');
                      }
                    },
                    borderRadius: BorderRadius.circular(100),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainerLow.withValues(alpha: 0.6),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 18,
                        color: AppColors.onSurface,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Logo Lambe thương hiệu chuẩn
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

                  // 2. Chính giữa: Tiêu đề cố định "Chi Tiết Dịch Vụ"
                  const Expanded(
                    child: Text(
                      'Chi Tiết Dịch Vụ',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 17, // font-headline-sm (18px)
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // 3. Bên phải: Chia sẻ, Yêu thích, Avatar người dùng
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Nút Chia sẻ
                      InkWell(
                        onTap: widget.onShare ??
                            () {
                              AppDialog.success(
                                context,
                                title: 'Chia sẻ dịch vụ',
                                message: 'Đã sao chép liên kết dịch vụ.',
                              );
                            },
                        borderRadius: BorderRadius.circular(100),
                        child: const SizedBox(
                          width: 38,
                          height: 38,
                          child: Icon(
                            Icons.share_outlined,
                            size: 21,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ),

                      // Nút Yêu thích
                      InkWell(
                        onTap: () {
                          setState(() {
                            _isFavorite = !_isFavorite;
                          });
                          widget.onFavorite?.call();
                        },
                        borderRadius: BorderRadius.circular(100),
                        child: SizedBox(
                          width: 38,
                          height: 38,
                          child: Icon(
                            _isFavorite
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            size: 21,
                            color: _isFavorite
                                ? AppColors.error
                                : AppColors.onSurfaceVariant,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),

                      // Avatar người dùng (w-8 h-8 rounded-full)
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary,
                          border: Border.all(
                            color: AppColors.surfaceContainerLowest,
                            width: 1.5,
                          ),
                        ),
                        child: ClipOval(
                          child: (avatarUrl != null && avatarUrl.isNotEmpty)
                              ? CachedNetworkImage(
                                  imageUrl: avatarUrl,
                                  width: 32,
                                  height: 32,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => const Icon(
                                    Icons.person_rounded,
                                    size: 18,
                                    color: AppColors.onPrimary,
                                  ),
                                )
                              : const Icon(
                                  Icons.person_rounded,
                                  size: 18,
                                  color: AppColors.onPrimary,
                                ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
