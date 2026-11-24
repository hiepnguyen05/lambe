import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../di/feed_providers.dart';
import '../../domain/feed_scope.dart';
import '../widgets/feed_end_of_feed_note.dart';
import '../widgets/feed_feedback.dart';
import '../widgets/feed_post_card.dart';
import '../widgets/feed_sub_nav_header.dart';
import '../widgets/feed_notices_sheet.dart';

class FeedScreen extends ConsumerStatefulWidget {
  final FeedMode initialMode;
  final bool showNotices;
  final String? providerId, serviceId;

  const FeedScreen({
    super.key,
    this.initialMode = FeedMode.all,
    this.showNotices = false,
    this.providerId,
    this.serviceId,
  });

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  late FeedMode _currentMode;
  String? _selectedCategorySlug;

  @override
  void initState() {
    super.initState();
    _currentMode = widget.initialMode;
    if (widget.showNotices) _openNotices();
  }

  void _openNotices() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        FeedNoticesSheet.show(context);
      }
    });
  }

  @override
  void didUpdateWidget(covariant FeedScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.showNotices && !oldWidget.showNotices) _openNotices();
    if (widget.initialMode != oldWidget.initialMode) {
      _currentMode = widget.initialMode;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = ref.watch(
      authNotifierProvider.select(
        (v) => v.valueOrNull?.roles.contains('PROVIDER') == true,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Pinned Tabs & Category Filter at Top of Page
            FeedSubNavHeader(
              selectedMode: _currentMode,
              onModeChanged: (mode) {
                setState(() => _currentMode = mode);
              },
              selectedCategorySlug: _selectedCategorySlug,
              onCategoryChanged: (slug) {
                setState(() => _selectedCategorySlug = slug);
              },
              showSavedAndMine: provider,
              showBackButton: widget.providerId != null,
              onBackTap: () => context.pop(),
              onSearchTap: () => context.push('/services'),
              onComposeTap: provider
                  ? () => context.push('/feed/compose')
                  : null,
              onNotificationTap: () => FeedNoticesSheet.show(context),
            ),

            // Scrollable Feed List
            Expanded(
              child: _FeedPane(
                key: ValueKey(
                  '${_currentMode.name}_${widget.providerId}_${widget.serviceId}',
                ),
                scope: FeedScope(
                  mode: _currentMode,
                  providerId: widget.providerId,
                  serviceId: widget.serviceId,
                ),
                categorySlug: _selectedCategorySlug,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedPane extends ConsumerStatefulWidget {
  final FeedScope scope;
  final String? categorySlug;

  const _FeedPane({super.key, required this.scope, this.categorySlug});

  @override
  ConsumerState<_FeedPane> createState() => _FeedPaneState();
}

class _FeedPaneState extends ConsumerState<_FeedPane>
    with WidgetsBindingObserver {
  final _prefetched = <String>{};
  void _prefetch(String url) {
    if (_prefetched.contains(url)) return;
    if (_prefetched.length >= 60) _prefetched.clear();
    _prefetched.add(url);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      precacheImage(
        ResizeImage(CachedNetworkImageProvider(url), width: 720),
        context,
        onError: (_, _) {},
      );
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ModalRoute.of(context)?.isCurrent == true &&
        TickerMode.valuesOf(context).enabled) {
      ref.read(feedListProvider(widget.scope).notifier).load(refresh: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedListProvider(widget.scope)),
        controller = ref.read(feedListProvider(widget.scope).notifier);
    final hidden = ref.watch(
      feedSignalsProvider.select(
        (s) => widget.scope.mode == FeedMode.mine ? s.deleted : s.unavailable,
      ),
    );

    final rawItems = state.items
        .where((post) => !hidden.contains(post.id))
        .toList(growable: false);

    // Apply category filter if active
    final items = widget.categorySlug == null
        ? rawItems
        : rawItems
              .where((post) {
                final query = widget.categorySlug!.toLowerCase();
                return post.services.any(
                      (s) => s.name.toLowerCase().contains(query),
                    ) ||
                    post.caption.toLowerCase().contains(query);
              })
              .toList(growable: false);

    return Column(
      children: [
        SizedBox(
          height: 3,
          child: state.loading
              ? const LinearProgressIndicator(
                  color: AppColors.primary,
                  backgroundColor: Colors.transparent,
                )
              : null,
        ),
        if (state.error != null)
          FeedFeedback(
            state.error!,
            retry: state.loading ? null : () => controller.load(refresh: true),
          ),
        if (state.cached)
          const Padding(
            padding: EdgeInsets.all(8),
            child: Text('Đang hiển thị bản đã lưu. Kéo xuống để cập nhật.'),
          ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => controller.load(refresh: true),
            child: ListView.builder(
              key: PageStorageKey(widget.scope),
              physics: const AlwaysScrollableScrollPhysics(),
              scrollCacheExtent: const ScrollCacheExtent.pixels(400),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              addAutomaticKeepAlives: false,
              itemCount: items.length + 1,
              itemBuilder: (context, index) {
                if (index < items.length) {
                  final nextIndex = index + 1;
                  if (nextIndex < items.length) {
                    final upcoming = items[nextIndex];
                    if (upcoming.media.isNotEmpty &&
                        !upcoming.media.first.video) {
                      _prefetch(upcoming.media.first.url);
                    }
                  }
                  return FeedPostCard(
                    key: ValueKey(items[index].id),
                    post: items[index],
                    manage: widget.scope.mode == FeedMode.mine,
                  );
                }

                if (state.cursor != null && !state.invalidCursor) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: BorderSide(
                          color: AppColors.primary.withValues(alpha: 0.3),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: state.loading ? null : () => controller.load(),
                      child: const Text(
                        'Xem thêm bài đăng',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  );
                }

                if (!state.loading && items.isEmpty && state.error == null) {
                  return const FeedFeedback(
                    'Chưa có bài đăng trong danh sách này.',
                  );
                }

                if (items.isNotEmpty && state.cursor == null) {
                  return const FeedEndOfFeedNote();
                }

                return const SizedBox(height: 16);
              },
            ),
          ),
        ),
      ],
    );
  }
}
