import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/chat_message_entity.dart';
import 'chat_message_delivery.dart';

class ChatTextBubble extends StatelessWidget {
  final ChatMessageEntity message;
  final bool isMine;
  final VoidCallback? onRetry;

  const ChatTextBubble({
    super.key,
    required this.message,
    required this.isMine,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.76,
        ),
        decoration: BoxDecoration(
          color: isMine ? AppColors.primary : AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMine ? 16 : 4),
            bottomRight: Radius.circular(isMine ? 4 : 16),
          ),
          border: isMine
              ? null
              : Border.all(color: AppColors.surfaceContainerHigh, width: 1),
          boxShadow: [
            BoxShadow(
              color: AppColors.onBackground.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Column(
          crossAxisAlignment: isMine
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message.text ?? '',
              style: TextStyle(
                fontSize: 14.5,
                color: isMine ? AppColors.onPrimary : AppColors.onBackground,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 4),
            ChatMessageDelivery(
              message: message,
              isMine: isMine,
              onRetry: onRetry,
              color: isMine
                  ? AppColors.onPrimary.withValues(alpha: 0.75)
                  : AppColors.textMuted,
              sentColor: isMine ? AppColors.onPrimary.withValues(alpha: 0.85) : AppColors.primary,
            ),
          ],
        ),
      ),
    );
  }
}
