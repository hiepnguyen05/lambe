import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/provider_reviews_repository.dart';
import '../domain/provider_review.dart';

class ProviderReviewsState {
  final ProviderReviewPage page;
  final bool loadingMore;
  final Object? pageError;
  const ProviderReviewsState(
    this.page, {
    this.loadingMore = false,
    this.pageError,
  });
}

class ProviderReviewsNotifier
    extends StateNotifier<AsyncValue<ProviderReviewsState>> {
  final ProviderReviewsRepository _repository;
  final String providerId;
  final _cancel = CancelToken();
  int _generation = 0;
  ProviderReviewsNotifier(this._repository, this.providerId)
    : super(const AsyncLoading()) {
    refresh();
  }

  Future<void> refresh() async {
    final generation = ++_generation;
    state = const AsyncLoading();
    try {
      final page = await _repository.list(providerId, cancelToken: _cancel);
      if (mounted && generation == _generation) {
        state = AsyncData(ProviderReviewsState(page));
      }
    } catch (error, stack) {
      if (mounted && generation == _generation) {
        state = AsyncError(error, stack);
      }
    }
  }

  Future<void> loadMore() async {
    final previous = state.valueOrNull;
    final cursor = previous?.page.nextCursor;
    if (previous == null || previous.loadingMore || cursor == null) return;
    final generation = _generation;
    state = AsyncData(ProviderReviewsState(previous.page, loadingMore: true));
    try {
      final next = await _repository.list(
        providerId,
        cursor: cursor,
        cancelToken: _cancel,
      );
      if (!mounted || generation != _generation) return;
      final items = {
        for (final row in previous.page.reviews) row.id: row,
        for (final row in next.reviews) row.id: row,
      };
      state = AsyncData(
        ProviderReviewsState(
          ProviderReviewPage(
            count: next.count,
            averageRating: next.averageRating,
            reviews: items.values.toList(),
            nextCursor: next.nextCursor == cursor ? null : next.nextCursor,
          ),
        ),
      );
    } catch (error) {
      if (mounted && generation == _generation) {
        state = AsyncData(
          ProviderReviewsState(previous.page, pageError: error),
        );
      }
    }
  }

  @override
  void dispose() {
    _cancel.cancel();
    super.dispose();
  }
}

final providerReviewsProvider = StateNotifierProvider.autoDispose
    .family<ProviderReviewsNotifier, AsyncValue<ProviderReviewsState>, String>(
      (ref, id) => ProviderReviewsNotifier(
        ref.watch(providerReviewsRepositoryProvider),
        id,
      ),
    );
