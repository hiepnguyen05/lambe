import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

class PublicProfileReviewsTab extends StatelessWidget {
  final PartnerPublicProfileEntity profile;

  const PublicProfileReviewsTab({
    super.key,
    required this.profile,
  });

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year.toString();
    return '$day/$month/$year';
  }

  @override
  Widget build(BuildContext context) {
    final reviews = profile.reviews;

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
                        profile.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.onSurface,
                        ),
                      ),
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
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: List.generate(
                      5,
                      (index) => Icon(
                        index < profile.rating.round()
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
        else
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
