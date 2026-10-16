import 'package:flutter/material.dart';

import '../../../domain/entities/nearby_technician_entity.dart';

class ServiceDetailTechniciansRail extends StatelessWidget {
  final List<NearbyTechnicianEntity> technicians;
  final ValueChanged<NearbyTechnicianEntity>? onSelectTechnician;
  final VoidCallback? onSeeAll;

  const ServiceDetailTechniciansRail({
    super.key,
    required this.technicians,
    this.onSelectTechnician,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tiêu đề phần chuyên gia + Chấm xanh online
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF10B981),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Chuyên gia gần bạn',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
              const Spacer(),
              if (technicians.isNotEmpty)
                TextButton(
                  onPressed: onSeeAll,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF0F766E),
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Xem tất cả',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          if (technicians.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFF1F5F9)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.person_search_rounded,
                      color: Color(0xFF94A3B8),
                      size: 24,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Chưa có chuyên viên gần bạn',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Hiện chưa có chuyên viên hoạt động gần khu vực của bạn cho dịch vụ này.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: technicians.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final tech = technicians[index];
                return _buildTechnicianCard(context, tech);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildTechnicianCard(BuildContext context, NearbyTechnicianEntity tech) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          // Avatar tròn với chấm online
          Stack(
            children: [
              ClipOval(
                child: Container(
                  width: 52,
                  height: 52,
                  color: const Color(0xFFE2E8F0),
                  child: tech.avatarUrl != null && tech.avatarUrl!.startsWith('http')
                      ? Image.network(
                          tech.avatarUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.person,
                            color: Color(0xFF94A3B8),
                            size: 28,
                          ),
                        )
                      : const Icon(
                          Icons.person,
                          color: Color(0xFF94A3B8),
                          size: 28,
                        ),
                ),
              ),
              if (tech.isOnline)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),

          // Thông tin thợ
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Tên + Huy hiệu xác thực (CCCD/Nghệ nhân)
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        tech.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: tech.badge == 'Nghệ nhân'
                            ? const Color(0xFFFEF3C7)
                            : const Color(0xFFE6F4F1),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Text(
                        tech.badge,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: tech.badge == 'Nghệ nhân'
                              ? const Color(0xFF92400E)
                              : const Color(0xFF0F766E),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Đánh giá sao, Khoảng cách, Số năm kinh nghiệm
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
                        tech.rating.toStringAsFixed(2),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                      const Text(
                        ' • ',
                        style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                      ),
                      Text(
                        '${tech.distanceKm} km',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Text(
                        ' • ',
                        style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                      ),
                      Text(
                        '${tech.experienceYears} năm KN',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Nút "Chọn chuyên viên"
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onSelectTechnician?.call(tech),
              borderRadius: BorderRadius.circular(100),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(
                    color: const Color(0xFF0F766E).withValues(alpha: 0.25),
                  ),
                ),
                child: const Text(
                  'Chọn chuyên viên',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F766E),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
