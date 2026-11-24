import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/chat_peer_entity.dart';

class ChatRoomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final ChatPeerEntity? peer;
  final String peerName;
  final bool isBlocked;
  final VoidCallback onReport;
  final VoidCallback onToggleBlock;

  const ChatRoomAppBar({
    super.key,
    required this.peer,
    required this.peerName,
    required this.isBlocked,
    required this.onReport,
    required this.onToggleBlock,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.surfaceContainerLowest,
      elevation: 0.5,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: AppColors.onBackground),
        onPressed: () => context.pop(),
      ),
      titleSpacing: 0,
      title: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Container(
              width: 38,
              height: 38,
              color: AppColors.surfaceContainerLow,
              child: peer?.avatarUrl != null && peer!.avatarUrl!.startsWith('http')
                  ? CachedNetworkImage(
                      imageUrl: peer!.avatarUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: AppColors.surfaceContainerLow,
                        child: const Icon(
                          Icons.person_rounded,
                          color: AppColors.textMuted,
                          size: 20,
                        ),
                      ),
                      errorWidget: (_, __, ___) => const Icon(
                        Icons.person_rounded,
                        color: AppColors.textMuted,
                        size: 20,
                      ),
                    )
                  : const Icon(
                      Icons.person_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  peerName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onBackground,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 1.5),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: AppColors.activeEmerald,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    const Text(
                      'Đang hoạt động',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert_rounded, color: AppColors.textMuted),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          onSelected: (value) {
            if (value == 'report') {
              onReport();
            } else if (value == 'block') {
              onToggleBlock();
            }
          },
          itemBuilder: (ctx) => [
            PopupMenuItem(
              value: 'report',
              child: Row(
                children: const [
                  Icon(Icons.flag_outlined, size: 18, color: AppColors.error),
                  SizedBox(width: 10),
                  Text(
                    'Báo cáo vi phạm',
                    style: TextStyle(fontSize: 13.5, color: AppColors.error),
                  ),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'block',
              child: Row(
                children: [
                  Icon(
                    isBlocked ? Icons.lock_open_rounded : Icons.block_rounded,
                    size: 18,
                    color: AppColors.onSurfaceVariant,
                  ),
                  SizedBox(width: 10),
                  Text(
                    isBlocked ? 'Bỏ chặn' : 'Chặn đối phương',
                    style: const TextStyle(
                      fontSize: 13.5,
                      color: AppColors.onBackground,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}
