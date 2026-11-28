import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/provider/reviews/data/provider_reviews_repository.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

class PublicProfileReviewsTab extends ConsumerStatefulWidget {
  final PartnerPublicProfileEntity profile;

  const PublicProfileReviewsTab({
    super.key,
    required this.profile,
  });

  @override
  ConsumerState<PublicProfileReviewsTab> createState() =>
      _PublicProfileReviewsTabState();
}

class _PublicProfileReviewsTabState
    extends ConsumerState<PublicProfileReviewsTab> {
  late List<PublicReviewItemEntity> _reviews;
  String? _nextCursor;
  bool _hasRequestedMore = false;
  bool _loadingMore = false;
  String? _loadError;
  final CancelToken _cancelToken = CancelToken();

  @override
  void initState() {
    super.initState();
    _reviews = List<PublicReviewItemEntity>.from(widget.profile.reviews);
  }

  @override
  void didUpdateWidget(covariant PublicProfileReviewsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile != widget.profile) {
      _reviews = List<PublicReviewItemEntity>.from(widget.profile.reviews);
      _nextCursor = null;
      _hasRequestedMore = false;
      _loadError = null;
    }
  }

  @override
  void dispose() {
    _cancelToken.cancel();
    super.dispose();
  }

  bool get _canLoadMore =>
      (_hasRequestedMore && _nextCursor != null) ||
      (!_hasRequestedMore &&
          widget.profile.reviewCount > _reviews.length &&
          widget.profile.id.isNotEmpty);

  Future<void> _loadMore() async {
    if (_loadingMore) return;
    setState(() {
      _loadingMore = true;
      _loadError = null;
    });
    try {
      final cursor =
          _nextCursor ?? (_reviews.isNotEmpty ? _reviews.last.id : null);
      final page = await ref
          .read(providerReviewsRepositoryProvider)
          .list(
            widget.profile.id,
            cursor: cursor,
            cancelToken: _cancelToken,
          );
      if (!mounted) return;
      final existingIds = _reviews.map((e) => e.id).toSet();
      final appended = page.reviews
          .where((r) => !existingIds.contains(r.id))
          .map(
            (r) => PublicReviewItemEntity(
              id: r.id,
              rating: r.rating,
              comment: r.comment ?? '',
              createdAt: r.createdAt,
              customerName: 'Khách hàng Lambe',
              assignedMemberName: r.assignedMemberName,
            ),
          )
          .toList();
      setState(() {
        _reviews = [..._reviews, ...appended];
        _nextCursor = page.nextCursor;
        _hasRequestedMore = true;
      });
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel || !mounted) return;
      setState(() => _loadError = 'Không thể tải thêm đánh giá.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e is AppFailure
            ? e.message
            : 'Không thể tải thêm đánh giá.';
      });
    } finally {
      if (mounted) {
        setState(() => _loadingMore = false);
      }
    }
  }

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year.toString();
    return '$day/$month/$year';
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.profile;
    final reviews = _reviews;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary Rating Header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        profile.rating?.toStringAsFixed(1) ?? '--',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.onSurface,
                        ),
                      ),
                      if (profile.rating != null) ...[
                        const SizedBox(width: 4),
                        const Text(
                          '/ 5.0',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.outline,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: List.generate(
                      5,
                      (index) => Icon(
                        index < (profile.rating ?? 0).round()
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        size: 18,
                        color: const Color(0xFFF59E0B),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${profile.reviewCount} lượt đánh giá thực tế',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      '100% đánh giá từ khách hàng đã trải nghiệm dịch vụ thành công qua Lambe.',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.onSurfaceVariant,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Reviews List
        if (reviews.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.outlineVariant.withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.rate_review_outlined,
                  size: 40,
                  color: AppColors.outline.withValues(alpha: 0.6),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Chuyên viên chưa có đánh giá nào từ khách hàng.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          )
        else ...[
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: reviews.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final review = reviews[index];
              return _buildReviewCard(review);
            },
          ),
          if (_loadError != null) ...[
            const SizedBox(height: 10),
            Text(
              _loadError!,
              style: const TextStyle(fontSize: 12, color: AppColors.error),
            ),
          ],
          if (_canLoadMore) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _loadingMore ? null : _loadMore,
                child: _loadingMore
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_loadError != null ? 'Thử lại' : 'Xem thêm đánh giá'),
              ),
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildReviewCard(PublicReviewItemEntity review) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Avatar
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceContainer,
                ),
                child: ClipOval(
                  child: review.customerAvatar != null &&
                          review.customerAvatar!.isNotEmpty
                      ? Image.network(
                          review.customerAvatar!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              _buildCustomerAvatarFallback(review.customerName),
                        )
                      : _buildCustomerAvatarFallback(review.customerName),
                ),
              ),
              const SizedBox(width: 10),
              // Customer Name & Date
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.customerName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDate(review.createdAt),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
              // Star rating
              Row(
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < review.rating
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    size: 15,
                    color: const Color(0xFFF59E0B),
                  ),
                ),
              ),
            ],
          ),
          if (review.assignedMemberName != null &&
              review.assignedMemberName!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Chuyên viên thực hiện: ${review.assignedMemberName}',
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ],
          if (review.comment.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              review.comment,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.onSurface,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCustomerAvatarFallback(String name) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'K';
    return Container(
      color: AppColors.primary.withValues(alpha: 0.12),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
        ),
      ),
    );
  }
}
