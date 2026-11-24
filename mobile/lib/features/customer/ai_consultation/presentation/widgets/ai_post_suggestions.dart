import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/ai_consultation_entities.dart';

class AiPostSuggestions extends StatelessWidget {
  final List<AiSuggestedPostEntity> posts;
  final ValueChanged<AiSuggestedPostEntity> onPostSelected;

  const AiPostSuggestions({
    super.key,
    required this.posts,
    required this.onPostSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (posts.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Mẫu thực tế để tham khảo',
            style: TextStyle(
              color: AppColors.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 142,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: posts.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final post = posts[index];
                return InkWell(
                  onTap: () => onPostSelected(post),
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    width: 112,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: SizedBox(
                            width: 112,
                            height: 105,
                            child:
                                post.thumbnailUrl?.startsWith('https://') ==
                                    true
                                ? CachedNetworkImage(
                                    imageUrl: post.thumbnailUrl!,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) =>
                                        const Icon(Icons.broken_image_outlined),
                                  )
                                : Container(
                                    color: AppColors.secondaryContainer
                                        .withValues(alpha: 0.5),
                                    child: const Center(
                                      child: Icon(
                                        Icons.play_circle_outline,
                                        color: AppColors.primary,
                                        size: 32,
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          post.serviceName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          post.providerName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
