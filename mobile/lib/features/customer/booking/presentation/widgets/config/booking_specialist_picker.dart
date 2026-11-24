import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/booking_draft_entity.dart';
import '../../providers/booking_draft_provider.dart';
import '../../providers/public_members_provider.dart';

class BookingSpecialistPicker extends ConsumerWidget {
  final BookingDraftEntity draft;

  const BookingSpecialistPicker({super.key, required this.draft});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providerId = draft.providerId;
    if (providerId == null || providerId.isEmpty) {
      return const SizedBox.shrink();
    }

    final specialistsAsync = ref.watch(publicMembersProvider(providerId));

    return specialistsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (specialists) {
        if (specialists.isEmpty) return const SizedBox.shrink();

        final selectedMemberId = draft.assignedMemberId;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.badge_outlined,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Chuyên viên thực hiện',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Chọn thợ bạn yêu thích hoặc để hệ thống tự động sắp xếp chuyên viên phù hợp nhất:',
                style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 14),

              // Option 1: Auto assign
              InkWell(
                onTap: () {
                  ref
                      .read(bookingDraftProvider.notifier)
                      .selectSpecialist(memberId: null, memberName: null);
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: selectedMemberId == null
                        ? AppColors.primaryContainer.withValues(alpha: 0.15)
                        : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: selectedMemberId == null
                          ? AppColors.primary
                          : const Color(0xFFE5E7EB),
                      width: selectedMemberId == null ? 1.5 : 1.0,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: selectedMemberId == null
                              ? AppColors.primary
                              : const Color(0xFF9CA3AF),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.auto_awesome,
                          color: Colors.white,
                          size: 14,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Hệ thống tự động sắp xếp (Khuyên dùng)',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0B1C30),
                              ),
                            ),
                            Text(
                              'Chọn chuyên viên có đánh giá cao nhất và phản hồi nhanh nhất',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        selectedMemberId == null
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked_rounded,
                        color: selectedMemberId == null
                            ? AppColors.primary
                            : const Color(0xFF9CA3AF),
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Option 2: Specific specialists list
              ...specialists.map((sp) {
                final isSelected = selectedMemberId == sp.id;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: () {
                      ref
                          .read(bookingDraftProvider.notifier)
                          .selectSpecialist(
                            memberId: sp.id,
                            memberName: sp.displayName,
                          );
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primaryContainer.withValues(alpha: 0.15)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : const Color(0xFFE5E7EB),
                          width: isSelected ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.primaryContainer
                                .withValues(alpha: 0.3),
                            backgroundImage: sp.avatarUrl != null
                                ? NetworkImage(sp.avatarUrl!)
                                : null,
                            child: sp.avatarUrl == null
                                ? const Icon(
                                    Icons.person,
                                    size: 20,
                                    color: AppColors.primary,
                                  )
                                : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  sp.displayName,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0B1C30),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Text(
                                      '${sp.experienceYears} năm KN',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF6B7280),
                                      ),
                                    ),
                                    if (sp.averageRating != null) ...[
                                      const SizedBox(width: 6),
                                      const Icon(
                                        Icons.star_rounded,
                                        size: 14,
                                        color: Color(0xFFF59E0B),
                                      ),
                                      Text(
                                        ' ${sp.averageRating!.toStringAsFixed(1)}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF1F2937),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            isSelected
                                ? Icons.check_circle_rounded
                                : Icons.radio_button_unchecked_rounded,
                            color: isSelected
                                ? AppColors.primary
                                : const Color(0xFF9CA3AF),
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}
