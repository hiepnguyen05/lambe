import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/utils/uuid_utils.dart';

import '../data/feed_repository.dart';
import '../data/feed_publishing_repository.dart';
import '../domain/feed_post.dart';
import '../domain/feed_draft.dart';
import '../domain/feed_scope.dart';
import 'feed_interactions_controller.dart';
import 'feed_error.dart';

class FeedPublishingState {
  final FeedPost? post;
  final bool busy, uncertain;
  final int? progress;
  final String? error;
  const FeedPublishingState({
    this.post,
    this.busy = false,
    this.uncertain = false,
    this.progress,
    this.error,
  });
}

class FeedPublishingController extends StateNotifier<FeedPublishingState> {
  final FeedRepository repository;
  final FeedPublishingRepository uploads;
  final FeedInteractionsController signals;
  final cancel = CancelToken();
  final void Function() changed;
  String? _idempotencyKey;
  FeedPublishingController(
    this.repository,
    this.uploads,
    this.signals, {
    required this.changed,
  }) : super(const FeedPublishingState());
  Future<FeedPost?> save(
    FeedDraft draft,
    List<XFile> files, {
    FeedPost? editing,
  }) async {
    if (state.busy || state.uncertain) return null;
    var sent = false;
    state = const FeedPublishingState(busy: true);
    try {
      final invalid = draft.validate();
      if (invalid != null) throw ValidationFailure(invalid);
      if (editing != null) {
        final fresh = await repository.detail(
          FeedDetailScope(editing.id, manage: true),
          cancel,
          signedIn: true,
        );
        if (!mounted) return null;
        if (fresh.revision != editing.revision) {
          throw const ValidationFailure(
            'Bài đã được sửa ở nơi khác. Hãy mở lại phiên bản mới trước khi lưu.',
          );
        }
      }
      sent = true;
      final value = editing != null
          ? await repository.update(
              editing.id,
              editing.revision,
              draft.caption,
              draft.serviceIds,
              cancel,
            )
          : await uploads.create(draft, files, cancel, (sent, total) {
              if (!mounted || total <= 0) return;
              final percent = ((sent / total * 100).floor() ~/ 5) * 5;
              if (state.progress != percent) {
                state = FeedPublishingState(busy: true, progress: percent);
              }
            }, _idempotencyKey ??= 'feed_${UuidUtils.generateV4()}');
      if (!mounted) return null;
      signals.markChanged(value);
      _idempotencyKey = null;
      state = FeedPublishingState(post: value);
      changed();
      return value;
    } catch (error) {
      final uncertain =
          sent && feedUncertain(error) && error is! ValidationFailure;
      if (!uncertain) _idempotencyKey = null;
      if (mounted) {
        state = FeedPublishingState(
          uncertain: uncertain,
          error: feedError(error),
        );
      }
      return null;
    }
  }

  Future<bool> remove(String id) async {
    if (state.busy || state.uncertain) return false;
    state = const FeedPublishingState(busy: true);
    var sent = false;
    try {
      await repository.detail(
        FeedDetailScope(id, manage: true),
        cancel,
        signedIn: true,
      );
      if (!mounted) return false;
      sent = true;
      await repository.remove(id, cancel);
      if (!mounted) return false;
      signals.unavailable(id, deleted: true);
      state = const FeedPublishingState();
      changed();
      return true;
    } catch (error) {
      if (mounted) {
        state = FeedPublishingState(
          uncertain: sent && feedUncertain(error),
          error: feedError(error),
        );
      }
      return false;
    }
  }

  void retryUncertain() {
    if (!state.busy) state = const FeedPublishingState();
  }

  void beginNewIntent() {
    _idempotencyKey = null;
    if (!state.busy) state = const FeedPublishingState();
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}
