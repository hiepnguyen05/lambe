import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

/// Optimized network image widget with memory cache constraints, disk caching,
/// and smooth fade-in animation to prevent jank and OOM errors.
class AppCachedImage extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? placeholder;
  final Widget? errorWidget;
  final int? memCacheWidth;
  final int? memCacheHeight;

  const AppCachedImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
    this.errorWidget,
    this.memCacheWidth,
    this.memCacheHeight,
  });

  /// Factory for avatar images (e.g. 40x40, 48x48) with automatic 2.5x DPR memory constraint
  factory AppCachedImage.avatar({
    Key? key,
    required String? imageUrl,
    double size = 48,
    BorderRadius? borderRadius,
    Widget? placeholder,
    Widget? errorWidget,
  }) {
    return AppCachedImage(
      key: key,
      imageUrl: imageUrl,
      width: size,
      height: size,
      fit: BoxFit.cover,
      borderRadius: borderRadius ?? BorderRadius.circular(size / 2),
      memCacheWidth: (size * 2.5).round(),
      memCacheHeight: (size * 2.5).round(),
      placeholder: placeholder,
      errorWidget: errorWidget,
    );
  }

  /// Factory for service thumbnails (e.g. 72x72 to 120x120)
  factory AppCachedImage.thumbnail({
    Key? key,
    required String? imageUrl,
    double width = 80,
    double height = 80,
    BorderRadius? borderRadius,
  }) {
    return AppCachedImage(
      key: key,
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: BoxFit.cover,
      borderRadius: borderRadius ?? BorderRadius.circular(12),
      memCacheWidth: (width * 2.5).round(),
      memCacheHeight: (height * 2.5).round(),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.trim().isEmpty) {
      return _buildFallback(context);
    }

    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 2.5;
    final targetMemWidth = memCacheWidth ?? (width != null ? (width! * dpr).round() : 720);
    final targetMemHeight = memCacheHeight ?? (height != null ? (height! * dpr).round() : null);

    Widget image = CachedNetworkImage(
      imageUrl: imageUrl!.trim(),
      width: width,
      height: height,
      fit: fit,
      memCacheWidth: targetMemWidth,
      memCacheHeight: targetMemHeight,
      fadeInDuration: const Duration(milliseconds: 150),
      fadeOutDuration: const Duration(milliseconds: 150),
      placeholder: (context, url) =>
          placeholder ??
          Container(
            width: width,
            height: height,
            color: AppColors.surfaceContainerLow,
          ),
      errorWidget: (context, url, error) =>
          errorWidget ?? _buildFallback(context),
    );

    if (borderRadius != null) {
      image = ClipRRect(borderRadius: borderRadius!, child: image);
    }

    return image;
  }

  Widget _buildFallback(BuildContext context) {
    Widget fallback = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: borderRadius,
      ),
      child: const Center(
        child: Icon(Icons.person, size: 22, color: AppColors.outline),
      ),
    );
    if (borderRadius != null) {
      fallback = ClipRRect(borderRadius: borderRadius!, child: fallback);
    }
    return fallback;
  }
}

