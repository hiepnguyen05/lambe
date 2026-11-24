import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../domain/entities/app_notification_entity.dart';
import '../providers/notifications_providers.dart';

import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/core/error/app_failure.dart';

class NotificationCard extends ConsumerWidget {
  final AppNotificationEntity notification;
  final String userId;

  const NotificationCard({
    super.key,
    required this.notification,
    required this.userId,
  });

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);

    if (difference.inMinutes < 1) {
      return 'Vừa xong';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes} phút trước';
    } else if (difference.inHours < 24 && now.day == time.day) {
      return 'Hôm nay, ${DateFormat('HH:mm').format(time.toLocal())}';
    } else if (difference.inDays < 2) {
      return 'Hôm qua, ${DateFormat('HH:mm').format(time.toLocal())}';
    } else {
      return DateFormat('HH:mm - dd/MM/yyyy').format(time.toLocal());
    }
  }

  Future<void> _handleTap(BuildContext context, WidgetRef ref) async {
    try {
      final notifier = ref.read(notificationsNotifierProvider(userId).notifier);
      final destination = await notifier.resolveDestination(notification);
      if (ref.read(authNotifierProvider).valueOrNull?.id != userId) return;
      if (!notification.isRead) await notifier.markAsRead(notification.id);
      if (!context.mounted ||
          ref.read(authNotifierProvider).valueOrNull?.id != userId) {
        return;
      }
      if (destination != null) context.push(destination);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is AppFailure
                  ? error.message
                  : 'Chưa mở được thông báo. Vui lòng thử lại.',
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isPromo = notification.category == NotificationCategory.promotion;
    final isOrder = notification.category == NotificationCategory.order;
    final event = notification.metadata?['event'] as String?;
    final isCancellation =
        event == 'CANCELLATION_REQUESTED' ||
        event == 'CANCELLATION_ESCALATED' ||
        event == 'ORDER_CANCELLED';
    final isCompleted =
        event == 'ORDER_COMPLETED' || event == 'CANCELLATION_APPROVED';

    final Color iconBg = isCancellation
        ? const Color(0xFFFEF2F2)
        : isCompleted
        ? const Color(0xFFF0FDF4)
        : isPromo
        ? const Color(0xFFFFF1F2)
        : isOrder
        ? const Color(0xFFF0FDFA)
        : const Color(0xFFEFF6FF);

    final Color iconColor = isCancellation
        ? const Color(0xFFDC2626)
        : isCompleted
        ? const Color(0xFF16A34A)
        : isPromo
        ? const Color(0xFFE11D48)
        : isOrder
        ? const Color(0xFF0F766E)
        : const Color(0xFF3B82F6);

    final IconData icon = isCancellation
        ? Icons.warning_amber_rounded
        : isCompleted
        ? Icons.check_circle_outline_rounded
        : isPromo
        ? Icons.card_giftcard_rounded
        : isOrder
        ? Icons.receipt_long_rounded
        : Icons.campaign_rounded;

    return Material(
      color: notification.isRead
          ? Colors.white
          : const Color(0xFF0F766E).withValues(alpha: 0.04),
      child: InkWell(
        onTap: () => _handleTap(context, ref),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon Avatar
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: notification.isRead
                                  ? FontWeight.w600
                                  : FontWeight.w700,
                              color: notification.isRead
                                  ? const Color(0xFF1E293B)
                                  : const Color(0xFF0F172A),
                              height: 1.35,
                            ),
                          ),
                        ),
                        if (!notification.isRead) ...[
                          const SizedBox(width: 8),
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(top: 5),
                            decoration: const BoxDecoration(
                              color: Color(0xFF0F766E),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 5),

                    Text(
                      notification.body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: notification.isRead
                            ? const Color(0xFF64748B)
                            : const Color(0xFF475569),
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Footer with Category pill and time
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: iconColor.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            notification.category.label,
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: iconColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _formatTime(notification.createdAt),
                          style: TextStyle(
                            fontSize: 11.5,
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
