import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../catalog/domain/entities/service_item_entity.dart';
import '../../../../../core/widgets/lambe_icon_widget.dart';

class BookingConfigServiceCard extends StatelessWidget {
  final ServiceItemEntity service;

  const BookingConfigServiceCard({
    super.key,
    required this.service,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Icon đại diện dịch vụ
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFE6F4F2),
                  Color(0xFFCCECE8),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFF0F766E).withValues(alpha: 0.15),
              ),
            ),
            child: Center(
              child: LambeIconWidget(
                iconStr: service.iconUrl?.isNotEmpty == true
                    ? service.iconUrl
                    : service.category.code,
                size: 32,
                color: const Color(0xFF0F766E),
                fallbackIcon: Icons.auto_awesome_rounded,
              ),
            ),
          ),
          const SizedBox(width: 14),

          // Thông tin dịch vụ
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    service.category.name,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  service.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      Icons.schedule_rounded,
                      size: 14,
                      color: Color(0xFF64748B),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${service.defaultDurationMinutes} phút',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text('•',
                        style: TextStyle(color: Color(0xFFCBD5E1))),
                    const SizedBox(width: 10),
                    Text(
                      'Từ ${currencyFormatter.format(service.minPriceAmount)}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
