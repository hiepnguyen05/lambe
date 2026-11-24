import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../di/chat_providers.dart';
import '../../domain/entities/chat_conversation_entity.dart';
import '../../domain/entities/chat_message_entity.dart';
import './chat_room_screen.dart';

class ChatInboxScreen extends ConsumerStatefulWidget {
  final String view;

  const ChatInboxScreen({super.key, this.view = 'customer'});

  @override
  ConsumerState<ChatInboxScreen> createState() => _ChatInboxScreenState();
}

class _ChatInboxScreenState extends ConsumerState<ChatInboxScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 150) {
      ref
          .read(chatInboxNotifierProvider(widget.view).notifier)
          .loadMoreConversations();
    }
  }

  String _formatTime(DateTime? date) {
    if (date == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final targetDate = DateTime(date.year, date.month, date.day);

    if (targetDate == today) {
      return DateFormat('HH:mm').format(date);
    } else if (targetDate == today.subtract(const Duration(days: 1))) {
      return 'Hôm qua';
    } else {
      return DateFormat('dd/MM').format(date);
    }
  }

  String _getMessagePreview(ChatConversationEntity conv) {
    if (conv.blockedByMe) {
      return '[Đã chặn cuộc trò chuyện này]';
    }

    final msg = conv.lastMessage;
    if (msg == null) return 'Chưa có tin nhắn nào';

    switch (msg.kind) {
      case ChatMessageKind.serviceCard:
        final card = msg.serviceCardPayload;
        return '[Thẻ dịch vụ: ${card?.serviceName ?? 'Dịch vụ'}]';
      case ChatMessageKind.orderEvent:
        return '[Cập nhật lịch hẹn dịch vụ]';
      case ChatMessageKind.image:
        return '[Hình ảnh]';
      case ChatMessageKind.text:
        return msg.text ?? 'Tin nhắn mới';
    }
  }

  @override
  Widget build(BuildContext context) {
    final inboxState = ref.watch(chatInboxNotifierProvider(widget.view));

    final filteredConversations = inboxState.conversations.where((conv) {
      if (_searchQuery.isEmpty) return true;
      final name = conv.peer.displayName.toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceContainerLowest,
        elevation: 0,
        title: const Text(
          'Tin nhắn',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.onBackground,
          ),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.primary),
            onPressed: () {
              ref
                  .read(chatInboxNotifierProvider(widget.view).notifier)
                  .refresh();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Container(
            color: AppColors.surfaceContainerLowest,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.outlineVariant.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.search_rounded,
                    size: 20,
                    color: AppColors.textMuted,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) {
                        setState(() {
                          _searchQuery = val.trim();
                        });
                      },
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.onBackground,
                      ),
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Tìm kiếm cuộc trò chuyện...',
                        hintStyle: TextStyle(
                          fontSize: 13.5,
                          color: AppColors.textMuted,
                        ),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        filled: false,
                        contentPadding: EdgeInsets.symmetric(vertical: 11),
                      ),
                    ),
                  ),
                  if (_searchQuery.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: AppColors.surfaceContainerHigh),

          // Body
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                await ref
                    .read(chatInboxNotifierProvider(widget.view).notifier)
                    .refresh();
              },
              child: inboxState.isLoading && inboxState.conversations.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    )
                  : filteredConversations.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.15,
                        ),
                        Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 76,
                                height: 76,
                                decoration: BoxDecoration(
                                  color: AppColors.primaryFixed.withValues(alpha: 0.3),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.forum_outlined,
                                  size: 38,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(height: 18),
                              Text(
                                _searchQuery.isNotEmpty
                                    ? 'Không tìm thấy kết quả phù hợp'
                                    : 'Chưa có cuộc trò chuyện nào',
                                style: const TextStyle(
                                  fontSize: 16.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.onBackground,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 40,
                                ),
                                child: Text(
                                  _searchQuery.isNotEmpty
                                      ? 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
                                      : 'Khi bạn trao đổi tư vấn dịch vụ với chuyên viên làm đẹp, hộp thoại sẽ xuất hiện tại đây.',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textMuted,
                                    height: 1.45,
                                  ),
                                ),
                              ),
                              if (_searchQuery.isEmpty &&
                                  widget.view == 'customer') ...[
                                const SizedBox(height: 22),
                                ElevatedButton.icon(
                                  onPressed: () => context.go('/explore'),
                                  icon: const Icon(
                                    Icons.explore_outlined,
                                    size: 18,
                                  ),
                                  label: const Text('Khám phá dịch vụ ngay'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: AppColors.onPrimary,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 22,
                                      vertical: 13,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      controller: _scrollController,
                      itemCount:
                          filteredConversations.length +
                          (inboxState.isLoadingMore ? 1 : 0),
                      separatorBuilder: (_, __) => const Divider(
                        height: 1,
                        thickness: 1,
                        indent: 76,
                        color: Color(0xFFF1F5F9),
                      ),
                      itemBuilder: (context, index) {
                        if (index == filteredConversations.length) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ),
                          );
                        }

                        final conv = filteredConversations[index];
                        final hasUnread = conv.unreadCount > 0;
                        final timeStr = _formatTime(conv.lastMessageAt);
                        final previewText = _getMessagePreview(conv);

                        return InkWell(
                          onTap: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (ctx) => ChatRoomScreen(
                                  conversationId: conv.id,
                                  providerId: conv.providerId,
                                  peer: conv.peer,
                                ),
                              ),
                            );
                            // Khi quay về inbox, làm mới danh sách
                            ref
                                .read(
                                  chatInboxNotifierProvider(widget.view)
                                      .notifier,
                                )
                                .refresh();
                          },
                          child: Container(
                            color: hasUnread
                                ? AppColors.primaryFixed.withValues(alpha: 0.12)
                                : AppColors.surfaceContainerLowest,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 13,
                            ),
                            child: Row(
                              children: [
                                // Avatar
                                Stack(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(16),
                                      child: Container(
                                        width: 50,
                                        height: 50,
                                        color: AppColors.surfaceContainerLow,
                                        child: conv.peer.avatarUrl != null &&
                                                conv.peer.avatarUrl!.startsWith('http')
                                            ? CachedNetworkImage(
                                                imageUrl: conv.peer.avatarUrl!,
                                                fit: BoxFit.cover,
                                                placeholder: (_, __) => Container(
                                                  color: AppColors.surfaceContainerLow,
                                                  child: const Icon(
                                                    Icons.person_rounded,
                                                    color: AppColors.textMuted,
                                                    size: 26,
                                                  ),
                                                ),
                                                errorWidget: (_, __, ___) => const Icon(
                                                  Icons.person_rounded,
                                                  color: AppColors.textMuted,
                                                  size: 26,
                                                ),
                                              )
                                            : const Icon(
                                                Icons.person_rounded,
                                                color: AppColors.primary,
                                                size: 26,
                                              ),
                                      ),
                                    ),
                                    Positioned(
                                      right: 0,
                                      bottom: 0,
                                      child: Container(
                                        width: 13,
                                        height: 13,
                                        decoration: BoxDecoration(
                                          color: AppColors.activeEmerald,
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: AppColors.surfaceContainerLowest,
                                            width: 2.2,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 12),

                                // Name + Preview
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Text(
                                              conv.peer.displayName,
                                              style: TextStyle(
                                                fontSize: 14.5,
                                                fontWeight: hasUnread
                                                    ? FontWeight.w700
                                                    : FontWeight.w600,
                                                color: AppColors.onBackground,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          Text(
                                            timeStr,
                                            style: TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: hasUnread
                                                  ? FontWeight.w700
                                                  : FontWeight.w500,
                                              color: hasUnread
                                                  ? AppColors.primary
                                                  : AppColors.textMuted,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              previewText,
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: hasUnread
                                                    ? FontWeight.w600
                                                    : FontWeight.normal,
                                                color: hasUnread
                                                    ? AppColors.onBackground
                                                    : AppColors.textMuted,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          if (hasUnread) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 7,
                                                vertical: 2.5,
                                              ),
                                              decoration: BoxDecoration(
                                                color: AppColors.primary,
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: Text(
                                                conv.unreadCount > 99
                                                    ? '99+'
                                                    : '${conv.unreadCount}',
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                  color: AppColors.onPrimary,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
