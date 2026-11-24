import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/entities/service_item_entity.dart';

/// Thẻ dịch vụ làm đẹp dành riêng cho màn hình Tìm kiếm / Khám phá ([ServicesListScreen]).
/// Thiết kế tuân thủ 100% mẫu layout tìm kiếm (3 dòng thông tin + nút "Chọn" viên thuốc).
/// Không dùng chung hoặc làm ảnh hưởng đến các màn hình khác (như Đặt lịch, Đối tác, Chat...).
class ExploreServiceCard extends StatelessWidget {
  final ServiceItemEntity service;
  final bool isSelected;
  final VoidCallback onToggle;
  final VoidCallback? onTap;

  const ExploreServiceCard({
    super.key,
    required this.service,
    required this.isSelected,
    required this.onToggle,
    this.onTap,
  });

  String _formatPrice(int amount) {
    return NumberFormat.decimalPattern('vi_VN').format(amount);
  }

  String _getBadgeLabel(ServiceItemEntity service) {
    if (service.requiresCertificate) return 'Hot';
    final cat = service.category.name.trim();
    final name = service.name.toLowerCase();
    if (name.contains('nam') ||
        cat.toLowerCase().contains('nam') ||
        cat.toLowerCase().contains('barber')) {
      return 'Barber';
    }
    if (name.contains('layer') ||
        name.contains('nữ') ||
        cat.toLowerCase().contains('nữ')) {
      return 'Hot';
    }
    if (cat.isNotEmpty && cat.length <= 10) {
      return cat;
    }
    return 'Gợi ý';
  }

  String _getDescription(ServiceItemEntity service) {
    if (service.description != null && service.description!.trim().isNotEmpty) {
      return service.description!.trim();
    }
    final name = service.name.toLowerCase();
    if (name.contains('nam')) {
      return 'Chuyên Fade, Side Part, vuốt sáp tạo kiểu cao cấp';
    }
    if (name.contains('nữ') || name.contains('layer')) {
      return 'Tư vấn form tóc theo dáng mặt kèm hấp dưỡng tóc chuyên sâu';
    }
    if (name.contains('gội')) {
      return 'Cắt tóc theo yêu cầu, gội đầu thư giãn, massage cổ vai gáy';
    }
    return 'Dịch vụ làm đẹp chuyên nghiệp, phục vụ tận tâm tại nhà';
  }

  @override
  Widget build(BuildContext context) {
    final badgeLabel = _getBadgeLabel(service);
    final isSecondaryBadge = badgeLabel == 'Hot';
    final description = _getDescription(service);

    return Container(
      margin: const EdgeInsets.only(bottom: 10), // gap-2.5 (10px)
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest, // bg-surface-container-lowest (#FFFFFF)
        borderRadius: BorderRadius.circular(16), // rounded-2xl (16px)
        border: Border.all(
          color: isSelected
              ? AppColors.primaryContainer
              : AppColors.outlineVariant.withValues(alpha: 0.20), // border-outline-variant/20
          width: isSelected ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03), // shadow-sm
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
          if (isSelected)
            BoxShadow(
              color: AppColors.primaryContainer.withValues(alpha: 0.12),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap ?? onToggle,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14), // p-3.5 (14px)
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Khối nội dung bên trái (flex-1 min-w-0)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Hàng 1: Tiêu đề + Huy hiệu tag (flex items-center gap-2)
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              service.name,
                              style: const TextStyle(
                                fontSize: 16, // font-title-md (16px)
                                fontWeight: FontWeight.w600,
                                color: AppColors.onSurface, // #0B1C30
                                height: 1.375, // 22/16
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8), // gap-2 (8px)
                          // Badge: span font-label-sm text-[10px] px-2 py-0.5 rounded-full font-semibold
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: isSecondaryBadge
                                  ? const Color(0xFFFFDBC8).withValues(alpha: 0.50) // secondary-fixed/50
                                  : AppColors.primaryFixed.withValues(alpha: 0.40), // primary-fixed/40
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: Text(
                              badgeLabel,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: isSecondaryBadge
                                    ? AppColors.secondary // #835335
                                    : AppColors.primary, // #005C55
                              ),
                            ),
                          ),
                        ],
                      ),

                      // Hàng 2: Mô tả ngắn (font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-1)
                      const SizedBox(height: 4), // mt-1 (4px)
                      Text(
                        description,
                        style: const TextStyle(
                          fontSize: 12, // font-body-sm (12px)
                          fontWeight: FontWeight.w400,
                          color: AppColors.onSurfaceVariant, // #3E4947
                          height: 1.5, // 18/12
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),

                      // Hàng 3: Thời lượng + Chấm • + "từ" + Giá (mt-2.5 flex items-center gap-3)
                      const SizedBox(height: 10), // mt-2.5 (10px)
                      Row(
                        children: [
                          // <span class="flex items-center gap-1 text-on-surface-variant">
                          const Icon(
                            Icons.schedule_rounded,
                            size: 15,
                            color: AppColors.outline, // text-outline (#6E7977)
                          ),
                          const SizedBox(width: 4), // gap-1 (4px)
                          Text(
                            service.defaultDurationMinutes > 0
                                ? '${service.defaultDurationMinutes} phút'
                                : '30-45 phút',
                            style: const TextStyle(
                              fontSize: 12, // text-body-sm (12px)
                              fontWeight: FontWeight.w400,
                              color: AppColors.onSurfaceVariant, // #3E4947
                            ),
                          ),
                          const SizedBox(width: 12), // gap-3 (12px)
                          const Text(
                            '•',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.outlineVariant, // text-outline-variant (#BDC9C6)
                            ),
                          ),
                          const SizedBox(width: 12), // gap-3 (12px)
                          // <div class="flex items-center gap-1">
                          const Text(
                            'từ',
                            style: TextStyle(
                              fontSize: 12, // text-xs (12px)
                              color: AppColors.outline, // text-outline (#6E7977)
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          const SizedBox(width: 4), // gap-1 (4px)
                          Text(
                            '${_formatPrice(service.minPriceAmount)}đ',
                            style: const TextStyle(
                              fontSize: 14, // font-label-lg (14px)
                              fontWeight: FontWeight.bold, // font-bold
                              color: AppColors.primary, // text-primary (#005C55)
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12), // gap-3 (12px)

                // Nút "Chọn" / "Đã chọn" (px-4 py-2 rounded-full bg-primary-container text-on-primary font-label-md)
                InkWell(
                  onTap: onToggle,
                  borderRadius: BorderRadius.circular(100),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16, // px-4 (16px)
                      vertical: 8,   // py-2 (8px)
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.primaryContainer, // bg-primary-container (#0F766E)
                      borderRadius: BorderRadius.circular(100), // rounded-full
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primaryContainer.withValues(alpha: 0.25),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Text(
                      isSelected ? 'Đã chọn' : 'Chọn',
                      style: const TextStyle(
                        fontSize: 12, // font-label-md (12px)
                        fontWeight: FontWeight.w600,
                        color: AppColors.onPrimary, // text-on-primary (#FFFFFF)
                        letterSpacing: 0.24,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
