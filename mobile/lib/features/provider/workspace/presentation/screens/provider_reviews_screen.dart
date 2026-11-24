import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';

import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import '../../../reviews/application/provider_reviews_notifier.dart';
import '../../../reviews/presentation/provider_review_card.dart';

class ProviderReviewsScreen extends ConsumerWidget {
  const ProviderReviewsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(partnerProfileNotifierProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Đánh giá từ khách hàng')),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: TextButton(
            onPressed: () => ref.invalidate(partnerProfileNotifierProvider),
            child: const Text('Chưa tải được hồ sơ. Thử lại'),
          ),
        ),
        data: (p) => p.id.isEmpty
            ? const Center(child: Text('Chưa có hồ sơ đối tác.'))
            : _ReviewsList(providerId: p.id),
      ),
    );
  }
}

class _ReviewsList extends ConsumerWidget {
  final String providerId;
  const _ReviewsList({required this.providerId});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(providerReviewsProvider(providerId));
    final notifier = ref.read(providerReviewsProvider(providerId).notifier);
    return reviews.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              error is AppFailure ? error.message : 'Chưa tải được đánh giá.',
            ),
            TextButton(
              onPressed: notifier.refresh,
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
      data: (state) => RefreshIndicator(
        onRefresh: notifier.refresh,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          itemCount: state.page.reviews.length + 2,
          itemBuilder: (context, index) {
            if (index == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  state.page.averageRating == null
                      ? 'Chưa có đánh giá'
                      : '${state.page.averageRating!.toStringAsFixed(1)}/5 · ${state.page.count} đánh giá',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              );
            }
            if (index <= state.page.reviews.length) {
              final item = state.page.reviews[index - 1];
              return ProviderReviewCard(key: ValueKey(item.id), review: item);
            }
            if (state.loadingMore) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.page.nextCursor == null) return const SizedBox.shrink();
            return Column(
              children: [
                if (state.pageError != null)
                  const Text('Chưa tải được trang tiếp theo.'),
                TextButton(
                  onPressed: notifier.loadMore,
                  child: Text(state.pageError == null ? 'Xem thêm' : 'Thử lại'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
