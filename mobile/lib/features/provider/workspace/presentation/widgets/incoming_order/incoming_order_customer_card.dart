import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/app_cached_image.dart';

class IncomingOrderCustomerCard extends StatelessWidget {
  final String customerName;
  final String? customerAvatarUrl;
  final bool isVip;
  final double? rating;
  final int bookingCount;
  final String address;
  final double? distanceKm;
  final String? customerNote;

  const IncomingOrderCustomerCard({
    super.key,
    required this.customerName,
    this.customerAvatarUrl,
    required this.isVip,
    this.rating,
    required this.bookingCount,
    required this.address,
    required this.distanceKm,
    this.customerNote,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Khách hàng
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(100),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFCCFBF1),
                      width: 2,
                    ),
                  ),
                  child: AppCachedImage.avatar(
                    imageUrl: customerAvatarUrl,
                    size: 44,
                    errorWidget: const Icon(
                      Icons.person,
                      color: Color(0xFF64748B),
                      size: 22,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            customerName,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isVip) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 1.5,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'VIP',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF92400E),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      rating != null
                          ? '★ ${rating!.toStringAsFixed(1)} ($bookingCount lượt đặt dịch vụ)'
                          : '★ Chưa có đánh giá ($bookingCount lượt đặt dịch vụ)',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFB45309),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 9),

          // 2. Địa chỉ & Khoảng cách
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.location_on_rounded,
                size: 16,
                color: Color(0xFF0F766E),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      address,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF334155),
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.near_me_rounded,
                          size: 13,
                          color: Color(0xFF0F766E),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          distanceKm == null
                              ? 'Chưa có ước tính di chuyển'
                              : '~${distanceKm!.toStringAsFixed(1)} km tính phí',
                          style: const TextStyle(
                            fontSize: 11,
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

          // 3. Ghi chú (nếu có)
          if (customerNote != null && customerNote!.trim().isNotEmpty) ...[
            const SizedBox(height: 9),
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.note_alt_rounded,
                    size: 15,
                    color: Color(0xFFD97706),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF475569),
                          height: 1.35,
                        ),
                        children: [
                          const TextSpan(
                            text: 'Ghi chú: ',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          TextSpan(text: customerNote!),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
