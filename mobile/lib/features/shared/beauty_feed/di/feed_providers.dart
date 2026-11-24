import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../application/feed_interactions_controller.dart';
import '../application/feed_list_controller.dart';
import '../application/feed_detail_controller.dart';
import '../application/feed_comments_controller.dart';
import '../application/feed_publishing_controller.dart';
import '../data/feed_repository.dart';
import '../data/feed_publishing_repository.dart';
import '../data/feed_local_cache.dart';
import '../data/feed_engagement_reporter.dart';
import '../domain/feed_scope.dart';

final feedEngagementReporterProvider = Provider((ref) {
  final id = ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
  final reporter = FeedEngagementReporter(ref.watch(dioProvider), signedIn: id != null);
  ref.onDispose(reporter.dispose);
  return reporter;
});
final feedLocalCacheProvider = Provider((ref) {
  final cache = FeedLocalCache(
    account: ref.read(authNotifierProvider).valueOrNull?.id,
  );
  ref.listen(
    authNotifierProvider.select((state) => state.valueOrNull?.id),
    (_, next) => cache.switchAccount(next),
  );
  return cache;
});
final feedRepositoryProvider = Provider(
  (ref) => FeedRepository(
    ref.watch(dioProvider),
    local: ref.watch(feedLocalCacheProvider),
  ),
);
final feedUploadsProvider = Provider(
  (ref) => FeedPublishingRepository(ref.watch(dioProvider)),
);
final feedPublishingContextProvider =
    FutureProvider.autoDispose<FeedPublishingContext>((ref) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      final cancel = CancelToken();
      ref.onDispose(cancel.cancel);
      return ref.watch(feedUploadsProvider).context(cancel);
    });
final feedSignalsProvider =
    StateNotifierProvider.autoDispose<FeedInteractionsController, FeedSignals>((
      ref,
    ) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      return FeedInteractionsController(ref.watch(feedRepositoryProvider));
    });
final feedListProvider = StateNotifierProvider.autoDispose
    .family<FeedListController, FeedListState, FeedScope>((ref, scope) {
      final userId = ref.watch(
        authNotifierProvider.select((state) => state.valueOrNull?.id),
      );
      final hold = ref.keepAlive();
      Timer? expiry;
      ref.onCancel(
        () => expiry = Timer(const Duration(seconds: 30), hold.close),
      );
      ref.onResume(() => expiry?.cancel());
      ref.onDispose(() => expiry?.cancel());
      return FeedListController(
        ref.watch(feedRepositoryProvider),
        ref.watch(feedSignalsProvider.notifier),
        scope,
        userId != null,
        local: ref.watch(feedLocalCacheProvider),
      )..load();
    });
final feedDetailProvider = StateNotifierProvider.autoDispose
    .family<FeedDetailController, FeedDetailState, FeedDetailScope>((
      ref,
      scope,
    ) {
      final userId = ref.watch(
        authNotifierProvider.select((state) => state.valueOrNull?.id),
      );
      return FeedDetailController(
        ref.watch(feedRepositoryProvider),
        ref.watch(feedSignalsProvider.notifier),
        scope,
        userId != null,
      )..load();
    });
final feedCommentsProvider = StateNotifierProvider.autoDispose
    .family<FeedCommentsController, FeedCommentsState, String>((ref, id) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      return FeedCommentsController(ref.watch(feedRepositoryProvider), id)
        ..load();
    });
final feedPublisherProvider = StateNotifierProvider.autoDispose
    .family<FeedPublishingController, FeedPublishingState, String>((ref, id) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      final controller = FeedPublishingController(
        ref.watch(feedRepositoryProvider),
        ref.watch(feedUploadsProvider),
        ref.watch(feedSignalsProvider.notifier),
        changed: () {
          for (final mode in FeedMode.values) {
            final source = feedListProvider(FeedScope(mode: mode));
            if (ref.exists(source)) {
              unawaited(ref.read(source.notifier).load(refresh: true));
            }
          }
        },
      );
      KeepAliveLink? pending;
      final remove = controller.addListener((state) {
        if (state.busy || state.uncertain) {
          pending ??= ref.keepAlive();
        } else {
          pending?.close();
          pending = null;
        }
      });
      ref.onDispose(remove);
      return controller;
    });
