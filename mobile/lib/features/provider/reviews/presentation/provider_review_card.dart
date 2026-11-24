import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../domain/provider_review.dart';

class ProviderReviewCard extends StatelessWidget {
  final ProviderReview review;
  const ProviderReviewCard({super.key, required this.review});
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: Text('Đánh giá từ khách hàng')),
              const Icon(Icons.star_rounded, size: 18),
              Text('${review.rating}/5'),
            ],
          ),
          Text(DateFormat('dd/MM/yyyy').format(review.createdAt.toLocal())),
          if (review.assignedMemberName != null)
            Text('Chuyên viên: ${review.assignedMemberName}'),
          if (review.comment?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(review.comment!),
          ],
        ],
      ),
    ),
  );
}
