import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/widgets/lambe_icon_widget.dart';
import '../../domain/entities/service_item_entity.dart';

class ServiceCard extends StatelessWidget {
  final ServiceItemEntity service;
  final bool isSelected;
  final VoidCallback onToggle;
  final VoidCallback? onTap;

  const ServiceCard({
    super.key,
    required this.service,
    required this.isSelected,
    required this.onToggle,
    this.onTap,
  });

  String _formatPrice(int amount) {
    return NumberFormat.decimalPattern('vi_VN').format(amount);
  }

  String _getAudienceLabel(String audience) {
    switch (audience.toUpperCase()) {
      case 'FEMALE':
      case 'WOMEN':
        return 'Nữ giới';
      case 'MALE':
      case 'MEN':
        return 'Nam giới';
      default:
        return 'Mọi đối tượng';
    }
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isSelected
              ? const Color(0xFF10B981).withValues(alpha: 0.55)
              : const Color(0xFFF1F5F9),
          width: isSelected ? 1.5 : 1,
        ),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: const Color(0xFF0F766E).withValues(alpha: 0.1),
                  blurRadius: 12,
                  offset: const Offset(0, 3),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.025),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap ?? onToggle,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Top Section: Icon + Content + Toggle Button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon box pastel 48x48
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE6F4F1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      alignment: Alignment.center,
                      child: LambeIconWidget(
                        iconStr: service.iconUrl,
                        size: 24,
                        color: const Color(0xFF0F766E),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Content center
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Hàng tag: Badge & Thời lượng
                          Row(
                            children: [
                              // Badge nổi bật
                              if (service.requiresCertificate) ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.local_fire_department_rounded,
                                        size: 11,
                                        color: Color(0xFFD97706),
                                      ),
                                      SizedBox(width: 2),
                                      Text(
                                        'Phổ biến nhất',
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF92400E),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ] else ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: const Text(
                                    'Dịch vụ chuẩn',
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF065F46),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],

                              // Thời lượng
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.schedule_rounded,
                                    size: 12,
                                    color: Color(0xFF94A3B8),
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    '${service.defaultDurationMinutes} phút',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 5),

                          // Tên dịch vụ
                          Text(
                            service.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 6),

                          // Rating & Đối tượng
                          Row(
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 14,
                                color: Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 2),
                              const Text(
                                '4.96',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(width: 2),
                              const Text(
                                '(420+)',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                width: 3,
                                height: 3,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFCBD5E1),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _getAudienceLabel(service.targetAudience),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Add / Select Toggle Button
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: onToggle,
                        borderRadius: BorderRadius.circular(100),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFF0F766E)
                                : const Color(0xFFF1F5F9),
                            shape: BoxShape.circle,
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: const Color(0xFF0F766E)
                                          .withValues(alpha: 0.25),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Icon(
                            isSelected
                                ? Icons.check_rounded
                                : Icons.add_rounded,
                            size: 19,
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF475569),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                // 2. Bottom Divider & Price
                const SizedBox(height: 12),
                Container(
                  height: 1,
                  color: const Color(0xFFF1F5F9),
                ),
                const SizedBox(height: 8),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Giá dịch vụ từ',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${_formatPrice(service.minPriceAmount)}đ',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F766E),
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(width: 3),
                        const Text(
                          '/ lần',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
    );
  }
}
