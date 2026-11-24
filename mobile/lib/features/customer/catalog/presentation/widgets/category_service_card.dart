import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/lambe_icon_widget.dart';
import '../../domain/entities/service_item_entity.dart';

/// Thẻ dịch vụ gọn gàng dành riêng cho màn hình Danh Sách Dịch Vụ ([CategoryServicesScreen]).
/// Thiết kế chuẩn mẫu: Icon dịch vụ bo góc 48x48 (Squircle),
/// tên dịch vụ rõ ràng tinh gọn, rating sao, thời lượng, giá "từ ...đ" và nút "Đặt ngay".
class CategoryServiceCard extends StatelessWidget {
  final ServiceItemEntity service;
  final VoidCallback onBookNow;
  final VoidCallback? onTap;

  const CategoryServiceCard({
    super.key,
    required this.service,
    required this.onBookNow,
    this.onTap,
  });

  String _formatPrice(int amount) {
    return NumberFormat.decimalPattern('vi_VN').format(amount);
  }

  @override
  Widget build(BuildContext context) {
    final duration = service.defaultDurationMinutes > 0
        ? '${service.defaultDurationMinutes} phút'
        : '45 phút';

    return Container(
      margin: const EdgeInsets.only(bottom: 8), // Tinh gọn khoảng cách giữa các thẻ
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest, // bg-surface-container-lowest (#FFFFFF)
        borderRadius: BorderRadius.circular(16), // rounded-2xl
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.20),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025), // shadow-sm nhẹ nhàng
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap ?? onBookNow,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11), // Đệm gọn gàng
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // 1. Khối trên: Thumbnail HÌNH TRÒN 48x48 + Tên dịch vụ, Badge, Thời lượng & Sao
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Biểu tượng icon dịch vụ chuẩn LambeIconWidget (Full size squircle)
                    Container(
                      width: 48,
                      height: 48,
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: AppColors.primaryFixed.withValues(alpha: 0.32),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: LambeIconWidget(
                          iconStr: service.iconUrl?.isNotEmpty == true
                              ? service.iconUrl
                              : service.category.code,
                          size: 24,
                          imageSize: 48,
                          imageFit: BoxFit.cover,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12), // gap-3 (12px)

                    // Cột thông tin dịch vụ
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Hàng 1: Tên dịch vụ gọn gàng (không có tag/badge)
                          Text(
                            service.name,
                            style: const TextStyle(
                              fontSize: 15, // font-title-md gọn 15px
                              fontWeight: FontWeight.w600,
                              color: AppColors.onSurface, // #0B1C30
                              height: 1.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),

                          // Hàng 2: Thời lượng • Đánh giá sao (4.9 / 320)
                          Row(
                            children: [
                              const Icon(
                                Icons.schedule_rounded,
                                size: 13,
                                color: AppColors.onSurfaceVariant,
                              ),
                              const SizedBox(width: 3),
                              Text(
                                duration,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.onSurfaceVariant, // #3E4947
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Text(
                                '•',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.outlineVariant,
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.star_rounded,
                                size: 13,
                                color: AppColors.secondary, // text-secondary
                              ),
                              const SizedBox(width: 2),
                              const Text(
                                '4.9',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.secondary,
                                ),
                              ),
                              const SizedBox(width: 2),
                              const Text(
                                '(320)',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.outline,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // 2. Khối chân thẻ: Đơn giá Bắt đầu từ + Nút "Đặt ngay" tinh gọn
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Giá dịch vụ (từ [Giá]đ)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        const Text(
                          'từ ',
                          style: TextStyle(
                            fontSize: 11, // font-label-sm
                            color: AppColors.outline, // text-outline (#6E7977)
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        Text(
                          '${_formatPrice(service.minPriceAmount)}đ',
                          style: const TextStyle(
                            fontSize: 16, // font-headline-sm 16px gọn gàng
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryContainer, // #0F766E
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),

                    // Nút Đặt ngay gọn gàng (px-4 py-1.5)
                    InkWell(
                      onTap: onBookNow,
                      borderRadius: BorderRadius.circular(100),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer, // bg-primary-container (#0F766E)
                          borderRadius: BorderRadius.circular(100),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primaryContainer.withValues(alpha: 0.22),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Text(
                              'Đặt ngay',
                              style: TextStyle(
                                fontSize: 12, // font-label-md (12px)
                                fontWeight: FontWeight.w600,
                                color: AppColors.onPrimary, // text-on-primary (#FFFFFF)
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(
                              Icons.arrow_forward_rounded,
                              size: 14,
                              color: AppColors.onPrimary,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
