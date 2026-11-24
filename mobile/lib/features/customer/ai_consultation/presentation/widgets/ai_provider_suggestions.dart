import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/ai_consultation_entities.dart';

class AiProviderSuggestions extends StatelessWidget {
  final List<AiSuggestedProviderEntity> providers;
  final ValueChanged<AiSuggestedProviderEntity> onProviderSelected;

  const AiProviderSuggestions({
    super.key,
    required this.providers,
    required this.onProviderSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (providers.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Chuyên viên gợi ý',
            style: TextStyle(
              color: AppColors.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          ...providers
              .take(3)
              .map(
                (provider) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Material(
                    color: AppColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      onTap: () => onProviderSelected(provider),
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: AppColors.outlineVariant.withValues(alpha: 0.5),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            _ProviderAvatar(provider: provider),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    provider.displayName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.onSurface,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    provider.serviceName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.primary,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 4,
                                    children: [
                                      _ProviderFact(
                                        icon: Icons.near_me_outlined,
                                        label:
                                            '${provider.distanceKm.toStringAsFixed(1)} km',
                                      ),
                                      if (provider.experienceYears > 0)
                                        _ProviderFact(
                                          icon:
                                              Icons.workspace_premium_outlined,
                                          label:
                                              '${provider.experienceYears} năm kinh nghiệm',
                                        ),
                                      _ProviderFact(
                                        icon: Icons.schedule_outlined,
                                        label:
                                            '${provider.durationMinutes} phút',
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    _priceSummary(provider),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.onSurface,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.secondaryContainer.withValues(
                                  alpha: 0.5,
                                ),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    provider.available
                                        ? Icons.chat_bubble_outline_rounded
                                        : Icons.schedule_rounded,
                                    color: AppColors.primary,
                                    size: 18,
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    provider.available ? 'Tư vấn' : 'Xem lịch',
                                    style: const TextStyle(
                                      color: AppColors.primary,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }

  String _price(int amount) {
    if (amount <= 0) return 'Liên hệ';
    return '${NumberFormat.decimalPattern('vi_VN').format(amount)} đ';
  }

  String _priceSummary(AiSuggestedProviderEntity provider) {
    final servicePrice = _price(provider.priceAmount);
    final travelFee = provider.estimatedTravelFeeAmount;
    if (travelFee == null) {
      return '$servicePrice · Phí di chuyển tính khi đặt';
    }
    if (travelFee <= 0) {
      return '$servicePrice · Miễn phí di chuyển dự kiến';
    }
    return '$servicePrice · Phí di chuyển dự kiến ${_price(travelFee)}';
  }
}

class _ProviderFact extends StatelessWidget {
  final IconData icon;
  final String label;

  const _ProviderFact({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerHigh.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.onSurfaceVariant),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.onSurfaceVariant,
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProviderAvatar extends StatelessWidget {
  final AiSuggestedProviderEntity provider;

  const _ProviderAvatar({required this.provider});

  @override
  Widget build(BuildContext context) {
    final avatarUrl = provider.avatarUrl;
    if (avatarUrl == null || avatarUrl.isEmpty) {
      return Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.secondaryContainer.withValues(alpha: 0.5),
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.15),
            width: 1,
          ),
        ),
        child: const Icon(
          Icons.person_outline_rounded,
          color: AppColors.primary,
          size: 22,
        ),
      );
    }

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.15),
          width: 1,
        ),
      ),
      child: CachedNetworkImage(
        imageUrl: avatarUrl,
        memCacheWidth: 150,
        memCacheHeight: 150,
        imageBuilder: (context, imageProvider) =>
            CircleAvatar(radius: 21, backgroundImage: imageProvider),
        placeholder: (context, url) => Container(
          decoration: BoxDecoration(
            color: AppColors.secondaryContainer.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
        ),
        errorWidget: (context, url, error) => Container(
          decoration: BoxDecoration(
            color: AppColors.secondaryContainer.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.person_outline_rounded,
            color: AppColors.primary,
            size: 22,
          ),
        ),
      ),
    );
  }
}
