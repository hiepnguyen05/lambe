import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../application/chat_attachment_service.dart';

import 'package:mobile/core/routing/app_mode.dart';
import 'package:mobile/core/routing/app_mode_provider.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../application/chat_room_notifier.dart';
import '../../di/chat_providers.dart';
import '../../domain/entities/chat_message_entity.dart';
import '../../domain/entities/chat_peer_entity.dart';
import '../widgets/bubbles/chat_order_event_bubble.dart';
import '../widgets/bubbles/chat_image_bubble.dart';
import '../widgets/bubbles/chat_service_card_bubble.dart';
import '../widgets/bubbles/chat_text_bubble.dart';
import '../widgets/bars/chat_room_app_bar.dart';
import '../widgets/bars/chat_room_input_bar.dart';
import '../widgets/moderation/chat_block_confirm_dialog.dart';
import '../widgets/moderation/chat_report_bottom_sheet.dart';

class ChatRoomScreen extends ConsumerStatefulWidget {
  final String? conversationId;
  final String? providerId;
  final ChatPeerEntity? peer;
  final String? initialText;

  const ChatRoomScreen({
    super.key,
    this.conversationId,
    this.providerId,
    this.peer,
    this.initialText,
  });

  @override
  ConsumerState<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends ConsumerState<ChatRoomScreen>
    with WidgetsBindingObserver {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  late final ChatRoomParams _params;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _params = ChatRoomParams(
      conversationId: widget.conversationId,
      providerId: widget.providerId,
      peer: widget.peer,
    );

    _scrollController.addListener(_onScroll);
    _textController.addListener(_onTextChanged);

    if (widget.initialText != null && widget.initialText!.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref
            .read(chatRoomNotifierProvider(_params).notifier)
            .sendTextMessage(widget.initialText!.trim());
      });
    }
  }

  void _onTextChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _textController.removeListener(_onTextChanged);
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final notifier = ref.read(chatRoomNotifierProvider(_params).notifier);
    if (state == AppLifecycleState.resumed) {
      notifier.resumeUpdates();
      _markMessagesReadAfterFrame();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.inactive) {
      notifier.pauseUpdates();
    }
  }

  void _markMessagesReadAfterFrame() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted ||
          WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) {
        return;
      }
      ref
          .read(chatRoomNotifierProvider(_params).notifier)
          .markVisibleMessagesRead();
    });
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 150) {
      ref.read(chatRoomNotifierProvider(_params).notifier).loadOlderMessages();
    }
  }

  Future<void> _handleSendMessage() async {
    final text = _textController.text.trim();
    final room = ref.read(chatRoomNotifierProvider(_params));
    if (text.isEmpty || room.isSending || room.isLoading) return;

    _textController.clear();
    final success = await ref
        .read(chatRoomNotifierProvider(_params).notifier)
        .sendTextMessage(text);

    if (success && _scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _handlePickImage() async {
    final room = ref.read(chatRoomNotifierProvider(_params));
    if (room.isSending || room.isLoading) return;
    if (room.conversationId == null) {
      AppDialog.info(
        context,
        message: 'Hãy gửi một tin nhắn để bắt đầu hội thoại trước.',
      );
      return;
    }

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Row(
                children: [
                  Icon(
                    Icons.image_outlined,
                    color: Color(0xFF0F766E),
                    size: 22,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Gửi hình ảnh',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.camera_alt_rounded,
                    color: Color(0xFF0F766E),
                  ),
                ),
                title: const Text(
                  'Chụp ảnh mới',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                subtitle: const Text(
                  'Sử dụng camera để chụp hiện trạng',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              const Divider(
                height: 14,
                thickness: 0.5,
                color: Color(0xFFE2E8F0),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.photo_library_rounded,
                    color: Color(0xFF0F766E),
                  ),
                ),
                title: const Text(
                  'Chọn từ thư viện ảnh',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                subtitle: const Text(
                  'Tải ảnh có sẵn trên thiết bị',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source == null) return;

    try {
      final picker = ImagePicker();
      final List<XFile> picked;
      if (source == ImageSource.camera) {
        final image = await picker.pickImage(
          source: source,
          maxWidth: 2000,
          maxHeight: 2000,
          imageQuality: 85,
        );
        picked = image == null ? [] : [image];
      } else {
        picked = await picker.pickMultiImage(
          maxWidth: 2000,
          maxHeight: 2000,
          imageQuality: 85,
        );
      }
      if (picked.isEmpty || !mounted) return;

      if (picked.length > ChatAttachmentService.maxAttachments) {
        AppDialog.warning(
          context,
          message: 'Mỗi tin nhắn chỉ gửi tối đa 4 ảnh.',
        );
      }

      final processed = await ref
          .read(chatAttachmentServiceProvider)
          .prepareUploads(picked);

      if (!mounted) return;

      for (final name in processed.oversizedFiles) {
        AppDialog.warning(context, message: '$name vượt quá giới hạn 5 MB.');
      }

      if (processed.uploads.isEmpty) return;

      final success = await ref
          .read(chatRoomNotifierProvider(_params).notifier)
          .sendImages(processed.uploads);
      if (success && _scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    } catch (_) {
      if (mounted) {
        AppDialog.error(context, message: 'Không thể đọc ảnh đã chọn.');
      }
    }
  }

  Future<void> _handleReport() async {
    final notifier = ref.read(chatRoomNotifierProvider(_params).notifier);
    final reported = await ChatReportBottomSheet.show(
      context,
      onSubmit: ({required String reason, String? detail}) async {
        final ok = await notifier.report(reason: reason, detail: detail);
        return ok;
      },
    );

    if (reported == true && mounted) {
      AppDialog.success(
        context,
        title: 'Báo cáo vi phạm',
        message: 'Đã gửi báo cáo vi phạm tới ban quản trị Lambe.',
      );
    }
  }

  Future<void> _handleToggleBlock(bool isBlocked, String peerName) async {
    final confirmed = await ChatBlockConfirmDialog.show(
      context,
      isCurrentlyBlocked: isBlocked,
      peerName: peerName,
    );

    if (confirmed == true && mounted) {
      final success = await ref
          .read(chatRoomNotifierProvider(_params).notifier)
          .toggleBlock();
      if (success && mounted) {
        AppDialog.success(
          context,
          message: isBlocked
              ? 'Đã bỏ chặn cuộc trò chuyện.'
              : 'Đã chặn cuộc trò chuyện này.',
        );
      }
    }
  }

  String _formatDateHeader(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final targetDate = DateTime(date.year, date.month, date.day);

    if (targetDate == today) {
      return 'Hôm nay';
    } else if (targetDate == today.subtract(const Duration(days: 1))) {
      return 'Hôm qua';
    } else {
      return DateFormat('dd/MM/yyyy').format(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roomState = ref.watch(chatRoomNotifierProvider(_params));
    final notifier = ref.read(chatRoomNotifierProvider(_params).notifier);
    final currentUser = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId = currentUser?.id ?? '';
    final appMode = currentUser == null
        ? null
        : ref.watch(appModeProvider(currentUser.id)).valueOrNull;
    final isProviderMode = appMode == AppMode.provider;
    final peer = roomState.peer ?? widget.peer;
    final peerName = peer?.displayName ?? 'Chuyên viên Lambe';

    // Lắng nghe lỗi hiển thị Dialog
    ref.listen<ChatRoomState>(chatRoomNotifierProvider(_params), (prev, next) {
      if (next.errorMessage != null &&
          next.errorMessage != prev?.errorMessage) {
        AppDialog.error(context, message: next.errorMessage!);
      }
      if (next.highestSequence > (prev?.highestSequence ?? 0)) {
        _markMessagesReadAfterFrame();
      }
    });

    final messages = roomState.messages;
    final reversedMessages = messages.reversed.toList();
    final canSend = _textController.text.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.surface,
      resizeToAvoidBottomInset: true,
      appBar: ChatRoomAppBar(
        peer: peer,
        peerName: peerName,
        isBlocked: roomState.isBlocked,
        onReport: _handleReport,
        onToggleBlock: () => _handleToggleBlock(roomState.isBlocked, peerName),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Thông báo bảo mật
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              color: AppColors.surfaceContainerLow,
              child: const Row(
                children: [
                  Icon(
                    Icons.lock_outline_rounded,
                    size: 13,
                    color: AppColors.textMuted,
                  ),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Tin nhắn được bảo vệ an toàn. Không chia sẻ mã OTP hoặc thanh toán ngoài sàn.',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Danh sách tin nhắn
            Expanded(
              child: roomState.isLoading && messages.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                      ),
                    )
                  : reversedMessages.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                color: AppColors.primaryFixed.withValues(alpha: 0.3),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 36,
                                color: AppColors.primary,
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              'Bắt đầu trò chuyện với $peerName',
                              style: const TextStyle(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.onBackground,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Gửi tin nhắn hoặc yêu cầu tư vấn dịch vụ để được chuyên viên hỗ trợ chu đáo nhất.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12.5,
                                color: AppColors.textMuted,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      reverse: true,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      itemCount:
                          reversedMessages.length +
                          (roomState.isLoadingOlder ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == reversedMessages.length) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ),
                          );
                        }

                        final msg = reversedMessages[index];
                        final isMine =
                            msg.isMine(currentUserId) ||
                            msg.id.startsWith('pending:');
                        final VoidCallback? onRetry =
                            notifier.canRetryMessage(msg)
                            ? () => notifier.retryMessage(msg)
                            : null;

                        // Kiểm tra hiển thị header ngày
                        bool showDateHeader = false;
                        if (index == reversedMessages.length - 1) {
                          showDateHeader = true;
                        } else {
                          final prevMsg = reversedMessages[index + 1];
                          final d1 = msg.createdAt;
                          final d2 = prevMsg.createdAt;
                          if (d1.year != d2.year ||
                              d1.month != d2.month ||
                              d1.day != d2.day) {
                            showDateHeader = true;
                          }
                        }

                        Widget bubble;
                        switch (msg.kind) {
                          case ChatMessageKind.image:
                            bubble = ChatImageBubble(
                              message: msg,
                              isMine: isMine,
                              pendingImages: notifier.pendingImagesFor(msg),
                              onRetry: onRetry,
                            );
                            break;
                          case ChatMessageKind.serviceCard:
                            bubble = ChatServiceCardBubble(
                              message: msg,
                              isMine: isMine,
                              onRetry: onRetry,
                              onSelectService: () {
                                if (isProviderMode) {
                                  final serviceId = msg.providerServiceId;
                                  if (serviceId != null &&
                                      serviceId.isNotEmpty) {
                                    context.push('/provider/services/$serviceId');
                                  } else {
                                    context.push('/provider/services');
                                  }
                                } else {
                                  final targetProviderId =
                                      roomState.providerId ?? widget.providerId;
                                  if (targetProviderId != null &&
                                      targetProviderId.isNotEmpty) {
                                    context.push(
                                      '/providers/$targetProviderId/public',
                                    );
                                  } else {
                                    context.push('/services');
                                  }
                                }
                              },
                            );
                            break;
                          case ChatMessageKind.orderEvent:
                            bubble = ChatOrderEventBubble(
                              message: msg,
                              onViewOrder: () {
                                final orderId = msg.orderId;
                                if (orderId != null && orderId.isNotEmpty) {
                                  final targetRoute = isProviderMode
                                      ? '/provider/orders/$orderId'
                                      : '/appointments/$orderId';
                                  context.push(targetRoute);
                                }
                              },
                            );
                            break;
                          case ChatMessageKind.text:
                            bubble = ChatTextBubble(
                              message: msg,
                              isMine: isMine,
                              onRetry: onRetry,
                            );
                            break;
                        }

                        if (!showDateHeader) {
                          return bubble;
                        }

                        return Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              margin: const EdgeInsets.symmetric(vertical: 10),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 3.5,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceContainerHigh,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                _formatDateHeader(msg.createdAt),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ),
                            bubble,
                          ],
                        );
                      },
                    ),
            ),

            // Thanh nhập tin nhắn hoặc Banner chặn
            if (roomState.isBlocked)
              Container(
                color: AppColors.errorContainer.withValues(alpha: 0.5),
                child: SafeArea(
                  top: false,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.block_rounded,
                          color: AppColors.error,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Cuộc trò chuyện này đang bị chặn.',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.onErrorContainer,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () => _handleToggleBlock(true, peerName),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.error,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                          ),
                          child: const Text(
                            'Bỏ chặn',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              ChatRoomInputBar(
                controller: _textController,
                canSend: canSend,
                isSending: roomState.isSending || roomState.isLoading,
                onPickImage: _handlePickImage,
                onSendMessage: _handleSendMessage,
              ),
          ],
        ),
      ),
    );
  }
}
