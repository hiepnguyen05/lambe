import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/chat_message_entity.dart';

class ChatOrderEventBubble extends StatelessWidget {
  final ChatMessageEntity message;
  final VoidCallback? onViewOrder;

  const ChatOrderEventBubble({
    super.key,
    required this.message,
    this.onViewOrder,
  });

  @override
  Widget build(BuildContext context) {
    final payload = message.orderEventPayload;
    final orderId = payload?.orderId ?? message.orderId ?? '';
    final shortOrderId = orderId.length > 8
        ? orderId.substring(0, 8).toUpperCase()
        : orderId.toUpperCase();
    final timeStr = DateFormat('HH:mm, dd/MM').format(message.createdAt);

    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
        padding: const EdgeInsets.all(14),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.85,
        ),
        decoration: BoxDecoration(
          color: AppColors.hotBadgeBg.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.starAmber.withValues(alpha: 0.35),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.hotBadgeText.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.hotBadgeText,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.receipt_long_rounded,
                    size: 15,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  shortOrderId.isNotEmpty
                      ? 'Đơn hàng mới #$shortOrderId'
                      : 'Đơn hàng mới',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.hotBadgeText,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Một lịch hẹn mới đã được khởi tạo liên kết với cuộc trò chuyện này.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: AppColors.onSurfaceVariant,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 10),
            if (orderId.isNotEmpty)
              InkWell(
                onTap: onViewOrder,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.starAmber.withValues(alpha: 0.6),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Xem chi tiết đơn',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.hotBadgeText,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: AppColors.hotBadgeText,
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 6),
            Text(
              timeStr,
              style: TextStyle(
                fontSize: 10.5,
                color: AppColors.onSurfaceVariant.withValues(alpha: 0.75),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
