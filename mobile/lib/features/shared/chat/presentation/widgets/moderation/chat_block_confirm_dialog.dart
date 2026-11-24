import 'package:flutter/material.dart';

class ChatBlockConfirmDialog extends StatelessWidget {
  final bool isCurrentlyBlocked;
  final String peerName;

  const ChatBlockConfirmDialog({
    super.key,
    required this.isCurrentlyBlocked,
    required this.peerName,
  });

  static Future<bool?> show(
    BuildContext context, {
    required bool isCurrentlyBlocked,
    required String peerName,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => ChatBlockConfirmDialog(
        isCurrentlyBlocked: isCurrentlyBlocked,
        peerName: peerName,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = isCurrentlyBlocked ? 'Bỏ chặn $peerName?' : 'Chặn $peerName?';
    final content = isCurrentlyBlocked
        ? 'Sau khi bỏ chặn, bạn và người này có thể tiếp tục nhắn tin và gửi yêu cầu dịch vụ.'
        : 'Sau khi chặn, người này sẽ không thể gửi tin nhắn cho bạn và bạn cũng không thể gửi tin nhắn trong cuộc trò chuyện này.';

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(
            isCurrentlyBlocked ? Icons.lock_open_rounded : Icons.block_rounded,
            color: isCurrentlyBlocked
                ? const Color(0xFF0F766E)
                : const Color(0xFFDC2626),
            size: 22,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
      content: Text(
        content,
        style: const TextStyle(
          fontSize: 13.5,
          color: Color(0xFF475569),
          height: 1.4,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text(
            'Hủy',
            style: TextStyle(
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: ElevatedButton.styleFrom(
            backgroundColor: isCurrentlyBlocked
                ? const Color(0xFF0F766E)
                : const Color(0xFFDC2626),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: Text(
            isCurrentlyBlocked ? 'Bỏ chặn' : 'Xác nhận chặn',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}
