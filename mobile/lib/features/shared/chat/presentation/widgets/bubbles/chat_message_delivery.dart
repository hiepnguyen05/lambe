import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/chat_message_entity.dart';

class ChatMessageDelivery extends StatelessWidget {
  final ChatMessageEntity message;
  final bool isMine;
  final VoidCallback? onRetry;
  final Color color;
  final Color sentColor;

  const ChatMessageDelivery({
    super.key,
    required this.message,
    required this.isMine,
    this.onRetry,
    this.color = const Color(0xFF94A3B8),
    this.sentColor = const Color(0xFF0F766E),
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              DateFormat('HH:mm').format(message.createdAt),
              style: TextStyle(fontSize: 10.5, color: color),
            ),
            if (isMine) ...[
              const SizedBox(width: 4),
              if (message.isSending)
                SizedBox(
                  width: 10,
                  height: 10,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: sentColor,
                  ),
                )
              else if (message.hasError)
                const Icon(
                  Icons.error_outline_rounded,
                  size: 12,
                  color: Color(0xFFF87171),
                )
              else
                Icon(Icons.done_all_rounded, size: 13, color: sentColor),
            ],
          ],
        ),
        if (isMine && message.hasError && !message.isSending && onRetry != null)
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              foregroundColor: sentColor,
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, 28),
            ),
            child: const Text('Gửi lại'),
          ),
      ],
    );
  }
}
