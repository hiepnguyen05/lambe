import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../di/feed_providers.dart';
import '../../domain/feed_scope.dart';
import '../widgets/feed_feedback.dart';

class FeedVideoScreen extends ConsumerStatefulWidget {
  final String postId, mediaId;
  final bool manage;
  const FeedVideoScreen({
    super.key,
    required this.postId,
    required this.mediaId,
    this.manage = false,
  });
  @override
  ConsumerState<FeedVideoScreen> createState() => _FeedVideoScreenState();
}

class _FeedVideoScreenState extends ConsumerState<FeedVideoScreen>
    with WidgetsBindingObserver {
  VideoPlayerController? _player;
  int _generation = 0;
  bool _loading = false;
  String? _error;
  FeedDetailScope get scope =>
      FeedDetailScope(widget.postId, manage: widget.manage);
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void _stop() {
    _generation++;
    final player = _player;
    _player = null;
    if (player != null) unawaited(player.dispose());
    if (mounted) setState(() => _loading = false);
  }

  @override
  void didUpdateWidget(covariant FeedVideoScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.postId != widget.postId ||
        oldWidget.mediaId != widget.mediaId ||
        oldWidget.manage != widget.manage) {
      _stop();
      _error = null;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) _stop();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!TickerMode.valuesOf(context).enabled) _stop();
  }

  Future<void> _play() async {
    if (_loading || ModalRoute.of(context)?.isCurrent != true) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    await ref.read(feedDetailProvider(scope).notifier).load();
    if (!mounted || generation != _generation) return;
    final detail = ref.read(feedDetailProvider(scope));
    if (ModalRoute.of(context)?.isCurrent != true ||
        detail.loading ||
        detail.error != null) {
      setState(() {
        _loading = false;
        _error = detail.error;
      });
      return;
    }
    final matching =
        detail.post?.media.where((v) => v.video).toList() ?? [];
    final selectedMedia =
        matching.where((v) => v.id == widget.mediaId).firstOrNull ??
        matching.firstOrNull;
    if (selectedMedia == null) {
      setState(() {
        _loading = false;
        _error = 'Video không còn khả dụng.';
      });
      return;
    }
    final previous = _player;
    if (previous != null) await previous.dispose();
    if (!mounted || generation != _generation) return;
    final player = _player = VideoPlayerController.networkUrl(
      Uri.parse(selectedMedia.url),
    );
    try {
      await player.initialize();
      if (!mounted || generation != _generation) return;
      await player.play();
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted && generation == _generation) {
        _stop();
        setState(
          () => _error = 'Không phát được video. Hãy thử lại khi mạng ổn định.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(feedDetailProvider(scope));
    ref.listen(authNotifierProvider.select((v) => v.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != next) _stop();
    });
    final player = _player;
    return Scaffold(
      appBar: AppBar(title: const Text('Video tác phẩm')),
      body: Center(
        child: SingleChildScrollView(
          child: Column(
            children: [
              if (_error ?? detail.error case final String error)
                FeedFeedback(error),
              if (_loading || detail.loading) const CircularProgressIndicator(),
              if (player != null && player.value.isInitialized) ...[
                AspectRatio(
                  aspectRatio: player.value.aspectRatio,
                  child: VideoPlayer(player),
                ),
                VideoProgressIndicator(player, allowScrubbing: true),
                ValueListenableBuilder<VideoPlayerValue>(
                  valueListenable: player,
                  builder: (_, value, _) => IconButton(
                    tooltip: value.isPlaying ? 'Tạm dừng' : 'Phát',
                    icon: Icon(
                      value.isPlaying ? Icons.pause : Icons.play_arrow,
                    ),
                    onPressed: () =>
                        value.isPlaying ? player.pause() : player.play(),
                  ),
                ),
              ] else if (!_loading)
                FilledButton.icon(
                  onPressed: detail.loading ? null : _play,
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Phát video'),
                ),
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Video chỉ tải khi bạn chọn phát. Khi rời màn hoặc đưa app về nền, trình phát được đóng.',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _generation++;
    final player = _player;
    if (player != null) unawaited(player.dispose());
    super.dispose();
  }
}
