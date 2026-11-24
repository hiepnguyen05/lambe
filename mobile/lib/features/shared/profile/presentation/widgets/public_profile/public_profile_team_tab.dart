import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/customer/booking/domain/entities/public_specialist_entity.dart';
import 'package:mobile/features/customer/booking/presentation/providers/public_members_provider.dart';

class PublicProfileTeamTab extends ConsumerWidget {
  final String providerId;
  final Function(PublicSpecialistEntity specialist)? onSelectSpecialist;

  const PublicProfileTeamTab({
    super.key,
    required this.providerId,
    this.onSelectSpecialist,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final specialistsAsync = ref.watch(publicMembersProvider(providerId));

    return specialistsAsync.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 40),
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Text(
            'Không thể tải danh sách chuyên viên: ${e.toString()}',
            style: const TextStyle(color: Color(0xFF6B7280)),
          ),
        ),
      ),
      data: (specialists) {
        if (specialists.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Text(
                'Cơ sở chưa công khai danh sách kỹ thuật viên.',
                style: TextStyle(color: Color(0xFF6B7280)),
              ),
            ),
          );
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: specialists.length,
          separatorBuilder: (_, __) => const SizedBox(height: 14),
          itemBuilder: (context, index) {
            final item = specialists[index];
            final hasRating = item.averageRating != null;

            return Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor:
                            AppColors.primaryContainer.withValues(alpha: 0.3),
                        backgroundImage: item.avatarUrl != null
                            ? NetworkImage(item.avatarUrl!)
                            : null,
                        child: item.avatarUrl == null
                            ? const Icon(
                                Icons.person,
                                color: AppColors.primary,
                                size: 28,
                              )
                            : null,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.displayName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0B1C30),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF3F4F6),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '${item.experienceYears} năm kinh nghiệm',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF4B5563),
                                    ),
                                  ),
                                ),
                                if (hasRating) ...[
                                  const SizedBox(width: 8),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.star_rounded,
                                        size: 16,
                                        color: Color(0xFFF59E0B),
                                      ),
                                      const SizedBox(width: 2),
                                      Text(
                                        item.averageRating!.toStringAsFixed(1),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF1F2937),
                                        ),
                                      ),
                                      Text(
                                        ' (${item.reviewCount})',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF9CA3AF),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (item.services.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: item.services.take(4).map((s) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            s.name,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF1E40AF),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                  if (onSelectSpecialist != null) ...[
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.event_available_rounded, size: 18),
                        label: const Text('Đặt lịch với chuyên gia này'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: () => onSelectSpecialist!(item),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }
}

