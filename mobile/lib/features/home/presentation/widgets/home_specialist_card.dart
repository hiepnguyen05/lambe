import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/specialist_item.dart';

export '../../domain/entities/specialist_item.dart';

class HomeSpecialistCard extends StatelessWidget {
  final SpecialistItem specialist;
  final VoidCallback? onBookTap;
  final VoidCallback? onCardTap;

  const HomeSpecialistCard({
    super.key,
    required this.specialist,
    this.onBookTap,
    this.onCardTap,
  });

  String _formatPrice(int price) {
    final str = price.toString();
    final buffer = StringBuffer();
    int count = 0;
    for (int i = str.length - 1; i >= 0; i--) {
      buffer.write(str[i]);
      count++;
      if (count % 3 == 0 && i > 0) {
        buffer.write('.');
      }
    }
    return buffer.toString().split('').reversed.join();
  }

  @override
  Widget build(BuildContext context) {
    final formattedPrice = _formatPrice(specialist.startingPrice);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFE2EBF8),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onCardTap ?? onBookTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Avatar + Specialist Info + Tag
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar with badge
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: AppColors.surfaceContainerHigh,
                              width: 1.5,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(14.5),
                            child: specialist.avatarUrl.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: specialist.avatarUrl,
                                    width: 58,
                                    height: 58,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(
                                      color: AppColors.surfaceContainer,
                                      child: const Center(
                                        child: SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),
                                    ),
                                    errorWidget: (context, url, error) =>
                                        Container(
                                      color: AppColors.surfaceContainer,
                                      child: Center(
                                        child: Text(
                                          specialist.name.isNotEmpty
                                              ? specialist.name[0].toUpperCase()
                                              : '?',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 20,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                : Container(
                                    color: AppColors.surfaceContainer,
                                    child: Center(
                                      child: Text(
                                        specialist.name.isNotEmpty
                                            ? specialist.name[0].toUpperCase()
                                            : '?',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 20,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                                  ),
                          ),
                        ),
                        if (specialist.isVerified)
                          Positioned(
                            right: -3,
                            bottom: -3,
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.verified_rounded,
                                size: 16,
                                color: Color(0xFF007DF0),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),

                    // Name + Specialty + Highlight
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  specialist.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15.5,
                                    color: AppColors.onSurface,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (specialist.highlightTag != null) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 2.5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF2E8),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    specialist.highlightTag!,
                                    style: const TextStyle(
                                      color: Color(0xFFD95C00),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            specialist.specialty,
                            style: const TextStyle(
                              color: AppColors.onSurfaceVariant,
                              fontSize: 12.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 8),

                          // Rating and Distance row
                          Row(
                            children: [
                              // Star rating
                              const Icon(
                                Icons.star_rounded,
                                size: 16,
                                color: Color(0xFFFFB800),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                '${specialist.rating}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.onSurface,
                                ),
                              ),
                              Text(
                                ' (${specialist.reviewCount})',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.outline,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                width: 3,
                                height: 3,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.outlineVariant,
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Distance & ETA
                              const Icon(
                                Icons.near_me_rounded,
                                size: 12,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 3),
                              Flexible(
                                child: Text(
                                  '${specialist.distance} • ${specialist.eta}',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Divider line
                const Divider(
                  height: 1,
                  thickness: 0.8,
                  color: Color(0xFFEEF3FC),
                ),
                const SizedBox(height: 12),

                // Bottom row: Starting Price + Book Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Giá dịch vụ từ',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.outline,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '$formattedPrice₫',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primary,
                              ),
                            ),
                            Text(
                              ' / ${specialist.unit}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // "Đặt lịch ngay" button
                    ElevatedButton(
                      onPressed: onBookTap ?? onCardTap,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 9,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Đặt lịch ngay',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(
                            Icons.arrow_forward_rounded,
                            size: 14,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
