import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/ai_consultation_entities.dart';

class AiServiceSuggestions extends StatelessWidget {
  final List<AiSuggestedServiceEntity> services;
  final VoidCallback onExploreServices;
  final ValueChanged<AiSuggestedServiceEntity> onServiceSelected;

  const AiServiceSuggestions({
    super.key,
    required this.services,
    required this.onExploreServices,
    required this.onServiceSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Dịch vụ phù hợp',
            style: TextStyle(
              color: AppColors.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          ...services
              .take(3)
              .map(
                (service) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: () => onServiceSelected(service),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainerLowest,
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
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.secondaryContainer.withValues(
                                alpha: 0.5,
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.spa_outlined,
                              color: AppColors.primary,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  service.name,
                                  style: const TextStyle(
                                    color: AppColors.onSurface,
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  _priceRange(service),
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.chevron_right_rounded,
                            size: 18,
                            color: AppColors.outline,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          TextButton.icon(
            onPressed: onExploreServices,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primary,
              textStyle: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            icon: const Icon(Icons.grid_view_rounded, size: 17),
            label: const Text('Xem danh sách dịch vụ'),
          ),
        ],
      ),
    );
  }

  String _priceRange(AiSuggestedServiceEntity service) {
    final formatter = NumberFormat.decimalPattern('vi_VN');
    if (service.minPriceAmount <= 0 && service.maxPriceAmount <= 0) {
      return 'Xem giá từ chuyên viên';
    }
    if (service.maxPriceAmount <= service.minPriceAmount) {
      return '${formatter.format(service.minPriceAmount)} đ';
    }
    return '${formatter.format(service.minPriceAmount)} - '
        '${formatter.format(service.maxPriceAmount)} đ';
  }
}
