import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class AiChatComposer extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final VoidCallback onSend;

  const AiChatComposer({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceContainerLowest,
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  enabled: enabled,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 900,
                  textCapitalization: TextCapitalization.sentences,
                  keyboardType: TextInputType.multiline,
                  decoration: InputDecoration(
                    hintText: enabled
                        ? 'Hỏi Lambe về làm đẹp...'
                        : 'Đang kết nối trợ lý...',
                    counterText: '',
                    filled: true,
                    fillColor: AppColors.surface,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide(
                        color: AppColors.outlineVariant.withValues(alpha: 0.55),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: const BorderSide(
                        color: AppColors.primary,
                        width: 1.4,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: controller,
                builder: (context, value, child) {
                  final canSend = enabled && value.text.trim().isNotEmpty;
                  return IconButton.filled(
                    tooltip: 'Gửi câu hỏi',
                    onPressed: canSend ? onSend : null,
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.onPrimary,
                      disabledBackgroundColor: AppColors.surfaceContainer,
                      disabledForegroundColor: AppColors.outline,
                      fixedSize: const Size(48, 48),
                    ),
                    icon: const Icon(Icons.arrow_upward_rounded),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
