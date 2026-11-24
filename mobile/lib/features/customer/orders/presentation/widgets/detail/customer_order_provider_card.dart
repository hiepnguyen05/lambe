import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

import '../../../domain/entities/customer_order_entity.dart';

class CustomerOrderProviderCard extends StatelessWidget {
  final CustomerOrderEntity order;
  final void Function(String phone)? onCall;
  final bool showRating;

  const CustomerOrderProviderCard({
    super.key,
    required this.order,
    this.onCall,
    this.showRating = true,
  });

  @override
  Widget build(BuildContext context) {
    final prv = order.provider;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceContainerHigh),
        boxShadow: [
          BoxShadow(
            color: AppColors.onBackground.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 50,
              height: 50,
              color: AppColors.surfaceContainerLow,
              child: prv?.avatarUrl != null && prv!.avatarUrl!.startsWith('http')
                  ? CachedNetworkImage(
                      imageUrl: prv.avatarUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: AppColors.surfaceContainerLow,
                        child: const Icon(
                          Icons.person_rounded,
                          color: AppColors.textMuted,
                          size: 24,
                        ),
                      ),
                      errorWidget: (_, __, ___) => const Icon(
                        Icons.person_rounded,
                        color: AppColors.textMuted,
                        size: 24,
                      ),
                    )
                  : const Icon(
                      Icons.person_rounded,
                      color: AppColors.textMuted,
                      size: 24,
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  prv?.displayName ?? 'Chuyên viên Lambe',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onBackground,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                if (showRating && prv?.rating != null)
                  Row(
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        size: 15,
                        color: AppColors.starAmber,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        prv!.rating!.toStringAsFixed(1),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.onBackground,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        '• Đối tác phục vụ',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  )
                else
                  const Text(
                    'Đối tác làm đẹp tại nhà',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                    ),
                  ),
              ],
            ),
          ),
          if (prv != null) ...[
            IconButton(
              onPressed: () {
                context.push(
                  '/chat/room',
                  extra: {
                    'providerId': prv.id,
                    'peer': ChatPeerEntity(
                      id: prv.id,
                      displayName: prv.displayName,
                      avatarUrl: prv.avatarUrl,
                    ),
                  },
                );
              },
              icon: Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: AppColors.primaryFixed.withValues(alpha: 0.25),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.primaryFixedDim.withValues(alpha: 0.5),
                  ),
                ),
                child: const Icon(
                  Icons.chat_bubble_outline_rounded,
                  color: AppColors.primary,
                  size: 18,
                ),
              ),
            ),
            if (prv.phone != null && prv.phone!.isNotEmpty && onCall != null)
              IconButton(
                onPressed: () => onCall!(prv.phone!),
                icon: Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: AppColors.primaryFixed.withValues(alpha: 0.25),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.primaryFixedDim.withValues(alpha: 0.5),
                    ),
                  ),
                  child: const Icon(
                    Icons.phone_rounded,
                    color: AppColors.primary,
                    size: 18,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
