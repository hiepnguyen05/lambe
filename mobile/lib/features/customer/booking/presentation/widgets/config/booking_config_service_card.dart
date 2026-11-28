import 'package:flutter/material.dart';

import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/core/widgets/lambe_icon_widget.dart';

class BookingConfigServiceCard extends StatelessWidget {
  final ServiceItemEntity service;

  const BookingConfigServiceCard({super.key, required this.service});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Icon đại diện dịch vụ
          Container(
            width: 48,
            height: 48,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6F5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF0F766E).withValues(alpha: 0.15),
              ),
            ),
            child: Center(
              child: LambeIconWidget(
                iconStr: service.iconUrl?.isNotEmpty == true
                    ? service.iconUrl
                    : service.category.code,
                size: 24,
                imageSize: 48,
                imageFit: BoxFit.cover,
                color: const Color(0xFF0F766E),
                fallbackIcon: Icons.auto_awesome_rounded,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Thông tin dịch vụ
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6F5),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        service.category.name,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                    ),
                    const Spacer(),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.schedule_rounded,
                          size: 13,
                          color: Color(0xFF64748B),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          '~${service.defaultDurationMinutes} phút',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  service.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
