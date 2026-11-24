import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/app_notification_entity.dart';

class NotificationsEmptyState extends StatelessWidget {
  final NotificationCategory category;

  const NotificationsEmptyState({super.key, required this.category});

  @override
  Widget build(BuildContext context) {
    final title = switch (category) {
      NotificationCategory.all => 'Chưa có thông báo nào',
      NotificationCategory.order => 'Không có thông báo đơn hàng',
      NotificationCategory.promotion => 'Chưa có ưu đãi mới',
      NotificationCategory.system => 'Không có thông báo hệ thống',
    };

    final subtitle = switch (category) {
      NotificationCategory.all => 'Các cập nhật đơn hàng, khuyến mãi và tin tức mới nhất sẽ hiển thị tại đây.',
      NotificationCategory.order =>
        'Bạn chưa có lịch hẹn nào đang thực hiện hoặc cần cập nhật.',
      NotificationCategory.promotion => 'Đừng lo! Hãy thường xuyên kiểm tra để không bỏ lỡ voucher và ưu đãi hấp dẫn.',
      NotificationCategory.system =>
        'Hệ thống hiện không có thông báo bảo trì hay thông tin an ninh mới.',
    };

    final IconData icon = switch (category) {
      NotificationCategory.all => Icons.notifications_none_rounded,
      NotificationCategory.order => Icons.receipt_long_outlined,
      NotificationCategory.promotion => Icons.discount_outlined,
      NotificationCategory.system => Icons.campaign_outlined,
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 38, color: AppColors.primary),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                color: Colors.grey.shade600,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () => context.push('/explore'),
              icon: const Icon(Icons.explore_outlined, size: 18),
              label: const Text('Khám phá dịch vụ'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary, width: 1.2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
