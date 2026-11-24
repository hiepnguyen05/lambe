import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/reviews/application/provider_reviews_notifier.dart';
import 'package:mobile/features/provider/reviews/data/provider_reviews_repository.dart';
import 'package:mobile/features/provider/reviews/domain/provider_review.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_profile_entity.dart';
import 'package:mobile/features/shared/profile/application/partner_profile_notifier.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_reviews_screen.dart';

void main() {
  test('repository requests the provider reviews page and cursor', () async {
    final dio = _Dio();
    final page = await ProviderReviewsRepository(dio)
        .list('p1', cursor: 'cursor1');
    expect(dio.path, '/providers/p1/reviews');
    expect(dio.lastQuery, {'limit': 20, 'cursor': 'cursor1'});
    expect(page.averageRating, isNull);
    expect(page.reviews, isEmpty);
  });

  test(
    'pagination deduplicates without recomputing global rating from one page',
    () async {
      final repo = _Reviews();
      final notifier = ProviderReviewsNotifier(repo, 'p1');
      addTearDown(notifier.dispose);
      await Future<void>.delayed(Duration.zero);
      await notifier.loadMore();
      final state = notifier.state.requireValue;
      expect(state.page.reviews.map((r) => r.id), ['r1', 'r2']);
      expect(state.page.count, 100);
      expect(state.page.averageRating, 4.2);
      expect(state.page.nextCursor, isNull);
      expect(repo.calls, 2);
    },
  );

  test(
    'pagination error retains loaded reviews and cursor for retry',
    () async {
      final repo = _Reviews()..failMore = true;
      final notifier = ProviderReviewsNotifier(repo, 'p1');
      addTearDown(notifier.dispose);
      await Future<void>.delayed(Duration.zero);
      await notifier.loadMore();
      expect(notifier.state.requireValue.page.reviews.length, 1);
      expect(notifier.state.requireValue.pageError, isNotNull);
      repo.failMore = false;
      await notifier.loadMore();
      expect(notifier.state.requireValue.page.reviews.length, 2);
    },
  );

  test('refresh supersedes an older page load', () async {
    final repo = _Reviews()..delayMore = true;
    final notifier = ProviderReviewsNotifier(repo, 'p1');
    addTearDown(notifier.dispose);
    await Future<void>.delayed(Duration.zero);
    final loading = notifier.loadMore();
    await notifier.refresh();
    repo.pending.complete(_page(['r2'], null));
    await loading;
    expect(notifier.state.requireValue.page.reviews.single.id, 'r1');
  });

  testWidgets(
    'no reviews shows an empty state without fabricated customers or rating',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            partnerProfileNotifierProvider.overrideWith(_Profile.new),
            providerReviewsRepositoryProvider.overrideWithValue(
              _EmptyReviews(),
            ),
          ],
          child: const MaterialApp(home: ProviderReviewsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Chưa có đánh giá'), findsOneWidget);
      expect(find.textContaining('4.9'), findsNothing);
      expect(find.text('Hoàng Mai Phương'), findsNothing);
      expect(find.text('Trần Bảo Anh'), findsNothing);
    },
  );
}

ProviderReviewPage _page(List<String> ids, String? cursor) =>
    ProviderReviewPage(
      count: 100,
      averageRating: 4.2,
      nextCursor: cursor,
      reviews: ids
          .map(
            (id) => ProviderReview(
              id: id,
              rating: 5,
              comment: 'Tốt',
              createdAt: DateTime.utc(2026, 10, 30),
            ),
          )
          .toList(),
    );

class _Reviews extends ProviderReviewsRepository {
  _Reviews() : super(Dio());
  int calls = 0;
  bool failMore = false, delayMore = false;
  final pending = Completer<ProviderReviewPage>();
  @override
  Future<ProviderReviewPage> list(
    String providerId, {
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    calls++;
    if (cursor == null) return _page(['r1'], 'cursor1');
    if (failMore) throw StateError('offline');
    if (delayMore) return pending.future;
    return _page(['r1', 'r2'], null);
  }
}

class _EmptyReviews extends ProviderReviewsRepository {
  _EmptyReviews() : super(Dio());
  @override
  Future<ProviderReviewPage> list(
    String providerId, {
    String? cursor,
    CancelToken? cancelToken,
  }) async => const ProviderReviewPage(count: 0, reviews: []);
}

class _Dio extends DioMixin implements Dio {
  String? path;
  Map<String, dynamic>? lastQuery;
  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    this.path = path;
    lastQuery = queryParameters;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': {
          'count': 0,
          'averageRating': null,
          'reviews': [],
          'nextCursor': null,
        },
      } as T,
    );
  }
}

class _Profile extends PartnerProfileNotifier {
  @override
  Future<PartnerProfileEntity> build() async =>
      const PartnerProfileEntity(id: 'p1', displayName: 'Thợ');
}
