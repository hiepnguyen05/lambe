import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:mobile/core/theme/app_colors.dart';

class FeedAutoplayVideoPlayer extends StatefulWidget {
  final String url;
  final double? duration;
  final VoidCallback? onFullscreen;

  const FeedAutoplayVideoPlayer({
    super.key,
    required this.url,
    this.duration,
    this.onFullscreen,
  });

  @override
  State<FeedAutoplayVideoPlayer> createState() =>
      _FeedAutoplayVideoPlayerState();
}

class _FeedAutoplayVideoPlayerState extends State<FeedAutoplayVideoPlayer>
    with WidgetsBindingObserver {
  VideoPlayerController? _controller;
  ScrollPosition? _scrollPosition;
  bool _initialized = false;
  bool _isPlaying = false;
  bool _userWantsPlay = true;
  bool _isMuted = false;
  bool _hasError = false;
  bool _isFullscreenOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initPlayer();
  }

  @override
  void didUpdateWidget(FeedAutoplayVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      final oldController = _controller;
      _controller = null;
      if (oldController != null) {
        unawaited(oldController.pause());
        unawaited(oldController.dispose());
      }
      _initialized = false;
      _isPlaying = false;
      _hasError = false;
      _initPlayer();
    }
  }

  ScrollPosition? _findVerticalScrollPosition() {
    ScrollPosition? position;
    context.visitAncestorElements((element) {
      final widget = element.widget;
      if (widget is Scrollable) {
        final axis = widget.axisDirection;
        if (axis == AxisDirection.down || axis == AxisDirection.up) {
          final state = (element as StatefulElement).state;
          if (state is ScrollableState) {
            position = state.position;
            return false;
          }
        }
      }
      return true;
    });
    return position;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final newPosition = _findVerticalScrollPosition();
    if (_scrollPosition != newPosition) {
      _scrollPosition?.removeListener(_checkVisibility);
      _scrollPosition = newPosition;
      _scrollPosition?.addListener(_checkVisibility);
    }

    _checkVisibility();
  }

  bool _computeIsVisible() {
    if (!mounted || _isFullscreenOpen) return false;

    // Check if TickerMode is enabled (false when tab is switched away)
    if (!TickerMode.valuesOf(context).enabled) return false;

    // Check if the current route is active (false when another screen is pushed)
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return false;

    final renderObject = context.findRenderObject();
    if (renderObject is! RenderBox ||
        !renderObject.hasSize ||
        !renderObject.attached) {
      return false;
    }

    try {
      final origin = renderObject.localToGlobal(Offset.zero);
      final boxHeight = renderObject.size.height;
      final screenHeight = MediaQuery.sizeOf(context).height;

      if (boxHeight <= 0 || screenHeight <= 0) return false;

      // Calculate how much of the video is visible inside the screen [0, screenHeight]
      final visibleTop = origin.dy.clamp(0.0, screenHeight);
      final visibleBottom = (origin.dy + boxHeight).clamp(0.0, screenHeight);
      final visibleHeight = (visibleBottom - visibleTop).clamp(0.0, boxHeight);

      // Video is considered visible if at least 25% of its height OR at least 120 pixels are on screen
      final isVisibleOnScreen =
          visibleHeight >= 120 || visibleHeight >= (boxHeight * 0.25);

      return isVisibleOnScreen;
    } catch (_) {
      return false;
    }
  }

  void _checkVisibility() {
    if (!mounted || _controller == null || !_initialized) return;

    final isVisible = _computeIsVisible();

    if (!isVisible) {
      if (_controller!.value.isPlaying) {
        _controller!.pause();
        if (mounted) setState(() => _isPlaying = false);
      }
      // Reset intent so when scrolled back into view it autoplays again
      _userWantsPlay = true;
    } else if (isVisible && !_controller!.value.isPlaying && _userWantsPlay) {
      _controller!.play();
      if (mounted) setState(() => _isPlaying = true);
    }
  }

  Future<void> _initPlayer() async {
    if (!mounted) return;
    setState(() {
      _hasError = false;
      _initialized = false;
    });

    try {
      final controller = VideoPlayerController.networkUrl(
        Uri.parse(widget.url),
      );
      _controller = controller;

      await controller.initialize();
      if (!mounted || _controller != controller) return;

      await controller.setLooping(true);
      await controller.setVolume(_isMuted ? 0.0 : 1.0);

      if (mounted) {
        setState(() {
          _initialized = true;
        });
      }

      // Check immediately whether to autoplay based on current visibility
      _checkVisibility();
    } catch (_) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _initialized = false;
        });
      }
    }
  }

  void _togglePlayPause() {
    final controller = _controller;
    if (controller == null || !_initialized) return;

    if (controller.value.isPlaying) {
      controller.pause();
      setState(() {
        _isPlaying = false;
        _userWantsPlay = false;
      });
    } else {
      controller.play();
      setState(() {
        _isPlaying = true;
        _userWantsPlay = true;
      });
    }
  }

  void _toggleMute() {
    final controller = _controller;
    if (controller == null || !_initialized) return;

    final newMuted = !_isMuted;
    controller.setVolume(newMuted ? 0.0 : 1.0);
    setState(() => _isMuted = newMuted);
  }

  void _openFullscreenViewer() {
    final controller = _controller;
    if (controller == null || !_initialized) return;

    setState(() => _isFullscreenOpen = true);

    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            fullscreenDialog: true,
            builder: (_) => FeedFullscreenVideoViewer(
              controller: controller,
              initialMuted: _isMuted,
              onMuteToggled: (muted) {
                _isMuted = muted;
              },
            ),
          ),
        )
        .then((_) {
          if (mounted) {
            setState(() {
              _isFullscreenOpen = false;
              _isPlaying = _controller?.value.isPlaying ?? false;
            });
            _checkVisibility();
          }
        });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _controller?.pause();
      if (mounted && _isPlaying) {
        setState(() => _isPlaying = false);
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scrollPosition?.removeListener(_checkVisibility);
    final controller = _controller;
    _controller = null;
    if (controller != null) {
      unawaited(controller.pause());
      unawaited(controller.dispose());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return Container(
        color: const Color(0xFF0F172A),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 32,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Video tác phẩm',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              TextButton(
                onPressed: _initPlayer,
                child: const Text(
                  'Bấm để phát lại',
                  style: TextStyle(
                    color: AppColors.primaryFixed,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (!_initialized || _controller == null || _isFullscreenOpen) {
      return Container(
        color: const Color(0xFF0F172A),
        child: const Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
          ),
        ),
      );
    }

    final controller = _controller!;

    return GestureDetector(
      onTap: _togglePlayPause,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Video surface cropped to fill TikTok style
          ClipRRect(
            child: SizedBox.expand(
              child: FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: controller.value.size.width,
                  height: controller.value.size.height,
                  child: VideoPlayer(controller),
                ),
              ),
            ),
          ),

          // Pause Overlay (TikTok style centered play icon)
          if (!_isPlaying)
            Container(
              color: Colors.black.withValues(alpha: 0.35),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 42,
                  ),
                ),
              ),
            ),

          // Bottom Controls: Fullscreen button & Mute Button
          Positioned(
            bottom: 12,
            right: 12,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: _openFullscreenViewer,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.fullscreen_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _toggleMute,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isMuted
                          ? Icons.volume_off_rounded
                          : Icons.volume_up_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Slim Video Progress Indicator at the bottom
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: VideoProgressIndicator(
              controller,
              allowScrubbing: true,
              padding: EdgeInsets.zero,
              colors: VideoProgressColors(
                playedColor: AppColors.primary,
                bufferedColor: Colors.white.withValues(alpha: 0.3),
                backgroundColor: Colors.black.withValues(alpha: 0.25),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Fullscreen immersive TikTok-style video viewer
class FeedFullscreenVideoViewer extends StatefulWidget {
  final VideoPlayerController controller;
  final bool initialMuted;
  final ValueChanged<bool>? onMuteToggled;

  const FeedFullscreenVideoViewer({
    super.key,
    required this.controller,
    required this.initialMuted,
    this.onMuteToggled,
  });

  @override
  State<FeedFullscreenVideoViewer> createState() =>
      _FeedFullscreenVideoViewerState();
}

class _FeedFullscreenVideoViewerState extends State<FeedFullscreenVideoViewer> {
  late bool _isMuted;
  late bool _isPlaying;

  @override
  void initState() {
    super.initState();
    _isMuted = widget.initialMuted;
    _isPlaying = widget.controller.value.isPlaying;
    widget.controller.setVolume(_isMuted ? 0.0 : 1.0);
    if (!_isPlaying) {
      widget.controller.play();
      _isPlaying = true;
    }
  }

  void _togglePlayPause() {
    if (widget.controller.value.isPlaying) {
      widget.controller.pause();
      setState(() => _isPlaying = false);
    } else {
      widget.controller.play();
      setState(() => _isPlaying = true);
    }
  }

  void _toggleMute() {
    final newMuted = !_isMuted;
    widget.controller.setVolume(newMuted ? 0.0 : 1.0);
    setState(() => _isMuted = newMuted);
    widget.onMuteToggled?.call(newMuted);
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Main Video Surface
          GestureDetector(
            onTap: _togglePlayPause,
            behavior: HitTestBehavior.opaque,
            child: Center(
              child: AspectRatio(
                aspectRatio: controller.value.aspectRatio > 0
                    ? controller.value.aspectRatio
                    : 9 / 16,
                child: VideoPlayer(controller),
              ),
            ),
          ),

          // Play/Pause Overlay Icon
          if (!_isPlaying)
            IgnorePointer(
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 56,
                  ),
                ),
              ),
            ),

          // Top Close Button
          Positioned(
            top: MediaQuery.of(context).padding.top + 10,
            left: 16,
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.close_rounded,
                  color: Colors.white,
                  size: 24,
                ),
              ),
            ),
          ),

          // Bottom Controls & Scrub bar
          Positioned(
            bottom: MediaQuery.of(context).padding.bottom + 16,
            left: 16,
            right: 16,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    ValueListenableBuilder<VideoPlayerValue>(
                      valueListenable: controller,
                      builder: (_, val, __) {
                        final cur = val.position;
                        final total = val.duration;
                        String f(Duration d) =>
                            '${d.inMinutes.remainder(60).toString().padLeft(2, '0')}:${d.inSeconds.remainder(60).toString().padLeft(2, '0')}';
                        return Text(
                          '${f(cur)} / ${f(total)}',
                          style: const TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        );
                      },
                    ),
                    GestureDetector(
                      onTap: _toggleMute,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.6),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _isMuted
                              ? Icons.volume_off_rounded
                              : Icons.volume_up_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: VideoProgressIndicator(
                    controller,
                    allowScrubbing: true,
                    padding: EdgeInsets.zero,
                    colors: VideoProgressColors(
                      playedColor: AppColors.primary,
                      bufferedColor: Colors.white.withValues(alpha: 0.3),
                      backgroundColor: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
