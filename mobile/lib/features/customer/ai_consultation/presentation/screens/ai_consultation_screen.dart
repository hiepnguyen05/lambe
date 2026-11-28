import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../application/ai_consultation_notifier.dart';
import '../../di/ai_consultation_providers.dart';
import '../../domain/entities/ai_consultation_entities.dart';
import '../widgets/ai_chat_composer.dart';
import '../widgets/ai_consultation_welcome.dart';
import '../widgets/ai_message_bubble.dart';
import '../widgets/ai_typing_indicator.dart';

class AiConsultationScreen extends ConsumerStatefulWidget {
  final String? initialPrompt;

  const AiConsultationScreen({super.key, this.initialPrompt});

  @override
  ConsumerState<AiConsultationScreen> createState() =>
      _AiConsultationScreenState();
}

class _AiConsultationScreenState extends ConsumerState<AiConsultationScreen>
    with WidgetsBindingObserver {
  final _textController = TextEditingController();
  final _focusNode = FocusNode();
  final _scrollController = ScrollController();
  bool _sentInitialPrompt = false;
  double? _lastLatitude;
  double? _lastLongitude;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final prompt = widget.initialPrompt?.trim();
      if (!_sentInitialPrompt && prompt != null && prompt.isNotEmpty) {
        _sentInitialPrompt = true;
        _sendText(prompt);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _textController.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(
        ref
            .read(aiConsultationNotifierProvider.notifier)
            .refreshLoadedRecommendations(),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(aiConsultationNotifierProvider);

    ref.listen<AiConsultationState>(aiConsultationNotifierProvider, (
      previous,
      next,
    ) {
      final countChanged = previous?.messages.length != next.messages.length;
      if (countChanged || previous?.isSending != next.isSending) {
        _scrollToLatest();
      }
    });

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text(
          'Trợ lý làm đẹp',
          style: TextStyle(
            color: AppColors.onSurface,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: Column(
        children: [
          if (state.isInitializing) const LinearProgressIndicator(minHeight: 2),
          if (state.errorMessage != null)
            _AiErrorBanner(
              message: state.errorMessage!,
              canRetry: state.conversationId == null,
              onRetry: () => ref
                  .read(aiConsultationNotifierProvider.notifier)
                  .retryInitialization(),
              onDismiss: () => ref
                  .read(aiConsultationNotifierProvider.notifier)
                  .clearError(),
            ),
          Expanded(
            child: state.messages.isEmpty
                ? SingleChildScrollView(
                    controller: _scrollController,
                    child: AiConsultationWelcome(onPromptSelected: _sendText),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.only(top: 12, bottom: 12),
                    itemCount:
                        state.messages.length + (state.isSending ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == state.messages.length) {
                        return const AiTypingIndicator();
                      }
                      final message = state.messages[index];
                      return AiMessageBubble(
                        message: message,
                        onRefreshRecommendations: () => ref
                            .read(aiConsultationNotifierProvider.notifier)
                            .refreshRecommendations(message.id),
                        onRetryMessage: (id) => ref
                            .read(aiConsultationNotifierProvider.notifier)
                            .retryMessage(id),
                        onLocationRequested: () => _performAction(
                          message,
                          'SELECT_ADDRESS',
                          _sendWithCurrentLocation,
                        ),
                        onExploreServices: () => context.push('/services'),
                        onServiceSelected: (service) =>
                            _openService(message, service),
                        onProviderSelected: (provider) =>
                            _openProvider(message, provider),
                        onPostSelected: (post) => _openPost(message, post),
                        onBookingTimeRequested: () => _performAction(
                          message,
                          'SELECT_BOOKING_TIME',
                          _chooseBookingTime,
                        ),
                        onSavedAddressRequested: () =>
                            _performAction(message, 'SELECT_ADDRESS', () {
                              _lastLatitude = null;
                              _lastLongitude = null;
                              context.push('/profile/address');
                            }),
                        onFindProviders: () => _performAction(
                          message,
                          'FIND_PROVIDER',
                          () => _sendText(
                            'Tìm chuyên viên phù hợp cho dịch vụ này',
                          ),
                        ),
                      );
                    },
                  ),
          ),
          AiChatComposer(
            controller: _textController,
            focusNode: _focusNode,
            enabled: !state.isInitializing && !state.isSending,
            onSend: () => _sendText(_textController.text),
          ),
        ],
      ),
    );
  }

  Future<void> _useRecommendation(
    AiConsultationMessageEntity message, {
    required bool Function(AiConsultationReplyEntity) isValid,
    required ValueChanged<AiConsultationReplyEntity> onValid,
    String? actionType,
    String? targetId,
  }) async {
    final notifier = ref.read(aiConsultationNotifierProvider.notifier);
    final current = ref
        .read(aiConsultationNotifierProvider)
        .messages
        .where((item) => item.id == message.id)
        .firstOrNull;
    if (current == null ||
        current.isRefreshingRecommendations ||
        current.recommendationsRefreshFailed) {
      return;
    }
    final fresh = await notifier.refreshRecommendations(message.id);
    if (!mounted) return;
    final latest = ref
        .read(aiConsultationNotifierProvider)
        .messages
        .where((item) => item.id == message.id)
        .firstOrNull;
    if (fresh != null &&
        (latest == null ||
            latest.isRefreshingRecommendations ||
            !identical(latest.result, fresh))) {
      return;
    }
    if (fresh == null || !isValid(fresh)) {
      await AppDialog.warning(
        context,
        message: fresh == null
            ? 'Chưa thể kiểm tra gợi ý. Bạn hãy thử lại nhé.'
            : 'Gợi ý này không còn khả dụng. Bạn hãy chọn gợi ý mới nhé.',
      );
      return;
    }
    final action = fresh.nextActions
        .where((item) => item.type == actionType && item.targetId == targetId)
        .firstOrNull;
    if (action != null) {
      unawaited(
        notifier.recordAction(fresh, action.type, targetId: action.targetId),
      );
    }
    onValid(fresh);
  }

  Future<void> _openService(
    AiConsultationMessageEntity message,
    AiSuggestedServiceEntity service,
  ) => _useRecommendation(
    message,
    actionType: 'VIEW_SERVICE',
    targetId: service.id,
    isValid: (fresh) =>
        service.id.isNotEmpty &&
        fresh.suggestedServices.any((item) => item.id == service.id),
    onValid: (fresh) {
      final selected = fresh.suggestedServices.firstWhere(
        (item) => item.id == service.id,
      );
      context.push(
        selected.slug.isNotEmpty
            ? '/services/detail?slug=${Uri.encodeComponent(selected.slug)}'
            : '/services',
      );
    },
  );

  Future<void> _openProvider(
    AiConsultationMessageEntity message,
    AiSuggestedProviderEntity provider,
  ) => _useRecommendation(
    message,
    isValid: (fresh) =>
        provider.providerServiceId.isNotEmpty &&
        fresh.suggestedProviders.any(
          (item) =>
              item.providerServiceId == provider.providerServiceId &&
              item.id.isNotEmpty,
        ),
    onValid: (fresh) {
      final selected = fresh.suggestedProviders.firstWhere(
        (item) => item.providerServiceId == provider.providerServiceId,
      );
      // Recommendations are snapshots; booking still checks current availability.
      context.push('/providers/${Uri.encodeComponent(selected.id)}/public');
    },
  );

  Future<void> _openPost(
    AiConsultationMessageEntity message,
    AiSuggestedPostEntity post,
  ) => _useRecommendation(
    message,
    actionType: 'VIEW_INSPIRATION',
    targetId: post.id,
    isValid: (fresh) =>
        post.id.isNotEmpty &&
        fresh.suggestedPosts.any((item) => item.id == post.id),
    onValid: (fresh) {
      final selected = fresh.suggestedPosts.firstWhere(
        (item) => item.id == post.id,
      );
      context.push('/inspiration/posts/${Uri.encodeComponent(selected.id)}');
    },
  );

  Future<void> _performAction(
    AiConsultationMessageEntity message,
    String type,
    VoidCallback onValid,
  ) {
    final original = message.result!;
    final action = original.nextActions
        .where((item) => item.type == type)
        .firstOrNull;
    return _useRecommendation(
      message,
      actionType: type,
      targetId: action?.targetId,
      isValid: (fresh) => action != null
          ? fresh.nextActions.any(
              (item) => item.type == type && item.targetId == action.targetId,
            )
          : fresh.nextAction == original.nextAction,
      onValid: (_) => onValid(),
    );
  }

  Future<void> _sendText(String text) async {
    final value = text.trim();
    if (value.isEmpty) return;
    _lastLatitude = null;
    _lastLongitude = null;
    _textController.clear();
    _focusNode.unfocus();
    await ref.read(aiConsultationNotifierProvider.notifier).sendMessage(value);
  }

  Future<void> _sendWithCurrentLocation() async {
    final location = await ref
        .read(userLocationProvider.notifier)
        .fetchLocation();
    if (!mounted) return;
    if (!location.hasPermission || location.error != null) {
      AppDialog.error(
        context,
        message: location.error ?? 'Không thể lấy vị trí hiện tại.',
      );
      return;
    }

    await ref
        .read(aiConsultationNotifierProvider.notifier)
        .sendMessage(
          'Tìm chuyên viên phù hợp gần vị trí hiện tại của tôi',
          latitude: location.latitude,
          longitude: location.longitude,
        );
    _lastLatitude = location.latitude;
    _lastLongitude = location.longitude;
  }

  Future<void> _chooseBookingTime() async {
    final type = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('Làm ngay'),
              leading: const Icon(Icons.bolt_outlined),
              onTap: () => Navigator.pop(context, 'ASAP'),
            ),
            ListTile(
              title: const Text('Đặt trước'),
              leading: const Icon(Icons.event_outlined),
              onTap: () => Navigator.pop(context, 'SCHEDULED'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || type == null) return;
    DateTime? scheduledAt;
    if (type == 'SCHEDULED') {
      final now = DateTime.now();
      final day = await showDatePicker(
        context: context,
        firstDate: now,
        lastDate: now.add(const Duration(days: 29)),
        initialDate: now,
      );
      if (!mounted || day == null) return;
      final time = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 2))),
      );
      if (!mounted || time == null) return;
      scheduledAt = DateTime(
        day.year,
        day.month,
        day.day,
        time.hour,
        time.minute,
      );
      if (scheduledAt.isBefore(DateTime.now().add(const Duration(hours: 1)))) {
        if (mounted) {
          AppDialog.error(
            context,
            message: 'Lịch đặt phải cách hiện tại ít nhất 60 phút.',
          );
        }
        return;
      }
    }
    await ref
        .read(aiConsultationNotifierProvider.notifier)
        .sendMessage(
          'Tìm chuyên viên phù hợp cho dịch vụ này',
          latitude: _lastLatitude,
          longitude: _lastLongitude,
          bookingType: type,
          scheduledAt: scheduledAt,
        );
  }

  void _scrollToLatest() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    });
  }
}

class _AiErrorBanner extends StatelessWidget {
  final String message;
  final bool canRetry;
  final VoidCallback onRetry;
  final VoidCallback onDismiss;

  const _AiErrorBanner({
    required this.message,
    required this.canRetry,
    required this.onRetry,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.errorContainer,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 9, 8, 9),
        child: Row(
          children: [
            const Icon(
              Icons.info_outline_rounded,
              color: AppColors.onErrorContainer,
              size: 19,
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.onErrorContainer,
                  fontSize: 12,
                ),
              ),
            ),
            if (canRetry)
              TextButton(onPressed: onRetry, child: const Text('Thử lại'))
            else
              IconButton(
                tooltip: 'Đóng thông báo',
                onPressed: onDismiss,
                icon: const Icon(Icons.close_rounded, size: 19),
              ),
          ],
        ),
      ),
    );
  }
}
