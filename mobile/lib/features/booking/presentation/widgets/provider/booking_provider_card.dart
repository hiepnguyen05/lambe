import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/booking_provider_candidate_entity.dart';

class BookingProviderCard extends StatelessWidget {
  final BookingProviderCandidateEntity candidate;
  final bool isSelected;
  final VoidCallback? onSelect;
  final VoidCallback? onChat;

  const BookingProviderCard({
    super.key,
    required this.candidate,
    this.isSelected = false,
    this.onSelect,
    this.onChat,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    const primaryTeal = Color(0xFF0F766E);
    final isAvailable = candidate.available;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected
              ? primaryTeal
              : (isAvailable
                  ? const Color(0xFFE2E8F0)
                  : const Color(0xFFE2E8F0).withValues(alpha: 0.7)),
          width: isSelected ? 1.8 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isSelected
                ? primaryTeal.withValues(alpha: 0.08)
                : const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isAvailable ? onSelect : null,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Row 1: Avatar + Tên + Đánh giá + Khoảng cách
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Avatar nhỏ gọn (44x44)
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            width: 44,
                            height: 44,
                            color: const Color(0xFFF1F5F9),
                            child: candidate.avatarUrl != null &&
                                    candidate.avatarUrl!.startsWith('http')
                                ? Image.network(
                                    candidate.avatarUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Icon(
                                      Icons.person,
                                      color: Color(0xFF94A3B8),
                                      size: 24,
                                    ),
                                  )
                                : const Icon(
                                    Icons.person,
                                    color: Color(0xFF94A3B8),
                                    size: 24,
                                  ),
                          ),
                        ),
                        Positioned(
                          right: -1,
                          bottom: -1,
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: isAvailable
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFF94A3B8),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 10),

                    // Tên và thông số
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  candidate.displayName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5,
                                  vertical: 1.5,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6F5),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  candidate.badge,
                                  style: const TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    color: primaryTeal,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),

                          // Rating, Khoảng cách & Kinh nghiệm
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.star_rounded,
                                  size: 14,
                                  color: Color(0xFFF59E0B),
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  candidate.rating.toStringAsFixed(2),
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1E293B),
                                  ),
                                ),
                                Text(
                                  ' (${candidate.reviewCount})',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                const Text(
                                  ' • ',
                                  style: TextStyle(
                                    color: Color(0xFFCBD5E1),
                                    fontSize: 11,
                                  ),
                                ),
                                Text(
                                  '${candidate.distanceKm} km',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: Color(0xFF475569),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const Text(
                                  ' • ',
                                  style: TextStyle(
                                    color: Color(0xFFCBD5E1),
                                    fontSize: 11,
                                  ),
                                ),
                                Text(
                                  '${candidate.experienceYears} năm KN',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 9),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 8),

                // Row 2: Mức giá + Nút Chat + Nút Chọn thợ
                Row(
                  children: [
                    // Mức giá gọn gàng
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          currencyFormatter.format(candidate.priceAmount),
                          style: TextStyle(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w800,
                            color: isAvailable
                                ? primaryTeal
                                : const Color(0xFF64748B),
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          '/ ${candidate.durationMinutes}p',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),

                    // Icon Chat nhắn tin trước với chuyên viên (34x34)
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: onChat,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6F5),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: primaryTeal.withValues(alpha: 0.25),
                            ),
                          ),
                          child: const Icon(
                            Icons.chat_bubble_outline_rounded,
                            size: 16,
                            color: primaryTeal,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Nút Chọn chuyên viên (height 34)
                    if (isAvailable)
                      SizedBox(
                        height: 34,
                        child: ElevatedButton(
                          onPressed: onSelect,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isSelected
                                ? primaryTeal
                                : const Color(0xFFEFF6F5),
                            foregroundColor:
                                isSelected ? Colors.white : primaryTeal,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 13,
                              vertical: 0,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: BorderSide(
                                color: primaryTeal.withValues(
                                  alpha: isSelected ? 1 : 0.3,
                                ),
                              ),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (isSelected) ...[
                                const Icon(Icons.check_rounded, size: 14),
                                const SizedBox(width: 4),
                              ],
                              Text(
                                isSelected ? 'Đã chọn' : 'Chọn thợ',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      Container(
                        height: 34,
                        alignment: Alignment.center,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          candidate.reason == 'OUTSIDE_WORKING_HOURS'
                              ? 'Ngoài giờ làm'
                              : (candidate.reason == 'PROVIDER_TIME_CONFLICT'
                                  ? 'Trùng lịch'
                                  : 'Bận lịch'),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),
                  ],
                ),

                // Khung giờ gợi ý nếu chuyên viên bận (rất gọn gàng)
                if (!isAvailable && candidate.suggestedSlots.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.event_available_rounded,
                          size: 13,
                          color: primaryTeal,
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          'Giờ trống gợi ý: ',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF475569),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            candidate.suggestedSlots
                                .take(2)
                                .map((s) => DateFormat('HH:mm dd/MM').format(s))
                                .join(', '),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: primaryTeal,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
