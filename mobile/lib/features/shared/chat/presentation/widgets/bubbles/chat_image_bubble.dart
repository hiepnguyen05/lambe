import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/network/upload_payload.dart';

import '../../../domain/entities/chat_message_entity.dart';
import 'chat_message_delivery.dart';
import 'chat_pending_images.dart';

class ChatImageBubble extends StatelessWidget {
  final ChatMessageEntity message;
  final bool isMine;
  final List<UploadPayload> pendingImages;
  final VoidCallback? onRetry;

  const ChatImageBubble({
    super.key,
    required this.message,
    required this.isMine,
    this.pendingImages = const [],
    this.onRetry,
  });

  void _openPreview(BuildContext context, ChatImageAttachment attachment) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.92),
      builder: (context) => Dialog.fullscreen(
        backgroundColor: Colors.transparent,
        child: Stack(
          children: [
            Positioned.fill(
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 4,
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: attachment.url,
                    fit: BoxFit.contain,
                    errorWidget: (_, __, ___) => const _ImageError(),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: IconButton.filledTonal(
                  tooltip: 'Đóng',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attachments = message.attachments;
    if (attachments.isEmpty && !message.id.startsWith('pending:')) {
      return const SizedBox.shrink();
    }

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 264),
        margin: EdgeInsets.only(
          left: isMine ? 52 : 12,
          right: isMine ? 12 : 52,
          bottom: 8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (attachments.isEmpty)
              ChatPendingImages(images: pendingImages)
            else if (attachments.length == 1)
              _ChatImageTile(
                attachment: attachments.first,
                aspectRatio: _aspectRatio(attachments.first),
                onTap: () => _openPreview(context, attachments.first),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 3,
                  mainAxisSpacing: 3,
                ),
                itemCount: attachments.length,
                itemBuilder: (context, index) {
                  final attachment = attachments[index];
                  return _ChatImageTile(
                    attachment: attachment,
                    aspectRatio: 1,
                    onTap: () => _openPreview(context, attachment),
                  );
                },
              ),
            const SizedBox(height: 4),
            ChatMessageDelivery(
              message: message,
              isMine: isMine,
              onRetry: onRetry,
            ),
          ],
        ),
      ),
    );
  }

  double _aspectRatio(ChatImageAttachment attachment) {
    if (attachment.width <= 0 || attachment.height <= 0) return 1;
    return (attachment.width / attachment.height).clamp(0.75, 1.5);
  }
}

class _ChatImageTile extends StatelessWidget {
  final ChatImageAttachment attachment;
  final double aspectRatio;
  final VoidCallback onTap;

  const _ChatImageTile({
    required this.attachment,
    required this.aspectRatio,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Material(
          color: const Color(0xFFE2E8F0),
          child: InkWell(
            onTap: onTap,
            child: CachedNetworkImage(
              imageUrl: attachment.url,
              memCacheWidth: 400,
              memCacheHeight: 400,
              fit: BoxFit.cover,
              placeholder: (_, __) => const Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
              errorWidget: (_, __, ___) => const _ImageError(),
            ),
          ),
        ),
      ),
    );
  }
}

class _ImageError extends StatelessWidget {
  const _ImageError();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFFE2E8F0),
      child: Center(
        child: Icon(Icons.broken_image_outlined, color: Color(0xFF64748B)),
      ),
    );
  }
}
