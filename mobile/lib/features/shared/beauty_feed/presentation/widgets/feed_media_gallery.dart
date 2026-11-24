import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/feed_post.dart';
import 'feed_autoplay_video_player.dart';

class FeedMediaGallery extends StatefulWidget {
  final FeedPost post;
  final bool managed;
  const FeedMediaGallery({super.key, required this.post, this.managed = false});
  @override
  State<FeedMediaGallery> createState() => _FeedMediaGalleryState();
}

class _FeedMediaGalleryState extends State<FeedMediaGallery> {
  int _index = 0;
  double? _dynamicRatio;
  double _maxLoadedDominance = 0;

  @override
  void initState() {
    super.initState();
    _resolveRatio();
  }

  @override
  void didUpdateWidget(covariant FeedMediaGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.post.id != widget.post.id ||
        oldWidget.post.media != widget.post.media) {
      _resolveRatio();
    }
  }

  void _resolveRatio() {
    final items = widget.post.media;
    if (items.isEmpty) return;

    // Check if any item already has server dimensions to find the dominant/largest image
    FeedMedia? dominant;
    double maxDominance = 0;
    for (final m in items) {
      if (m.width != null &&
          m.height != null &&
          m.height! > 0 &&
          m.width! > 0) {
        final d = (m.width! * m.height!).toDouble() * (m.height! / m.width!);
        if (d > maxDominance) {
          maxDominance = d;
          dominant = m;
        }
      }
    }

    if (dominant != null &&
        dominant.width != null &&
        dominant.height != null &&
        dominant.height! > 0) {
      _dynamicRatio = (dominant.width! / dominant.height!).clamp(0.5625, 1.91);
      return;
    }

    if (items.first.video) {
      _dynamicRatio = 4 / 5;
      return;
    }

    // Resolve from network image for items without server dimensions
    for (final item in items) {
      if (item.video) continue;
      try {
        final provider = CachedNetworkImageProvider(item.url);
        final stream = provider.resolve(ImageConfiguration.empty);
        late ImageStreamListener listener;
        listener = ImageStreamListener((imageInfo, _) {
          if (mounted) {
            final w = imageInfo.image.width;
            final h = imageInfo.image.height;
            if (h > 0 && w > 0) {
              final d = (w * h).toDouble() * (h / w);
              if (d > _maxLoadedDominance) {
                _maxLoadedDominance = d;
                setState(() {
                  _dynamicRatio = (w / h).clamp(0.5625, 1.91);
                });
              }
            }
          }
        }, onError: (_, __) {});
        stream.addListener(listener);
      } catch (_) {}
    }
  }

  Widget _placeholder() => Container(
    color: AppColors.surfaceContainerLow,
    child: const Center(
      child: Icon(
        Icons.image_outlined,
        color: AppColors.outlineVariant,
        size: 32,
      ),
    ),
  );

  Widget _errorWidget() => Container(
    color: AppColors.surfaceContainerLow,
    child: const Center(
      child: Icon(
        Icons.broken_image_outlined,
        color: AppColors.outlineVariant,
        size: 32,
      ),
    ),
  );

  Widget _buildSlideImage({
    required FeedMedia media,
    required double galleryRatio,
    required int pixels,
  }) {
    final double? mediaRatio =
        (media.width != null &&
            media.height != null &&
            media.height! > 0 &&
            media.width! > 0)
        ? (media.width!.toDouble() / media.height!.toDouble())
        : null;

    final bool matchesFrameRatio =
        mediaRatio != null && (mediaRatio - galleryRatio).abs() < 0.02;

    // If the image matches the frame aspect ratio exactly, fill the frame
    if (matchesFrameRatio) {
      return CachedNetworkImage(
        imageUrl: media.url,
        fit: BoxFit.cover,
        memCacheWidth: pixels,
        maxWidthDiskCache: 1200,
        placeholder: (_, _) => _placeholder(),
        errorWidget: (_, _, _) => _errorWidget(),
      );
    }

    // When an image has a different aspect ratio or smaller size:
    // Frame stays sized to the largest image, but the smaller image renders at its
    // proper/actual size without being blown up or cropped, with an ambient blurred backdrop.
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: AppColors.surfaceContainerLowest),

        // Ambient frosted blurred backdrop
        Positioned.fill(
          child: ClipRect(
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
              child: Opacity(
                opacity: 0.35,
                child: CachedNetworkImage(
                  imageUrl: media.url,
                  fit: BoxFit.cover,
                  memCacheWidth: 64,
                  placeholder: (_, _) => const SizedBox.shrink(),
                  errorWidget: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
            ),
          ),
        ),

        // Centered foreground image: respects proper size without stretching
        Center(
          child: CachedNetworkImage(
            imageUrl: media.url,
            fit: BoxFit.scaleDown,
            memCacheWidth: pixels,
            maxWidthDiskCache: 1200,
            placeholder: (_, _) => _placeholder(),
            errorWidget: (_, _, _) => _errorWidget(),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.post.media;
    if (items.isEmpty) return const SizedBox.shrink();
    final pixels =
        (MediaQuery.sizeOf(context).width *
                MediaQuery.devicePixelRatioOf(context))
            .round()
            .clamp(320, 1200);

    final isSingleVideo = items.length == 1 && items.first.video;

    // Determine the dominant/largest image to set the post frame
    FeedMedia? dominantMedia;
    double maxDominance = 0;
    for (final m in items) {
      if (m.width != null &&
          m.height != null &&
          m.height! > 0 &&
          m.width! > 0) {
        final d = (m.width! * m.height!).toDouble() * (m.height! / m.width!);
        if (d > maxDominance) {
          maxDominance = d;
          dominantMedia = m;
        }
      }
    }

    final double aspectRatio;
    if (dominantMedia != null &&
        dominantMedia.width != null &&
        dominantMedia.height != null &&
        dominantMedia.height! > 0) {
      aspectRatio = (dominantMedia.width! / dominantMedia.height!).clamp(
        0.5625,
        1.91,
      );
    } else if (_dynamicRatio != null) {
      aspectRatio = _dynamicRatio!;
    } else if (isSingleVideo) {
      aspectRatio = 4 / 5;
    } else {
      aspectRatio = 1.0;
    }

    return AspectRatio(
      aspectRatio: aspectRatio,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Media PageView
          PageView.builder(
            itemCount: items.length,
            onPageChanged: (value) => setState(() => _index = value),
            itemBuilder: (context, index) {
              final media = items[index];
              if (media.video) {
                return FeedAutoplayVideoPlayer(
                  key: ValueKey('video_${media.id}'),
                  url: media.url,
                  duration: media.duration,
                  onFullscreen: () => context.push(
                    '/feed/posts/${widget.post.id}/media/${media.id}${widget.managed ? '?manage=true' : ''}',
                  ),
                );
              }
              return _buildSlideImage(
                media: media,
                galleryRatio: aspectRatio,
                pixels: pixels,
              );
            },
          ),

          // Image Counter Badge (top-right)
          if (items.length > 1)
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  '${_index + 1}/${items.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),

          // Pagination Dots (bottom-center)
          if (items.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (int i = 0; i < items.length; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 2.5),
                          width: i == _index ? 7 : 5,
                          height: i == _index ? 7 : 5,
                          decoration: BoxDecoration(
                            color: i == _index
                                ? Colors.white
                                : Colors.white.withValues(alpha: 0.5),
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
