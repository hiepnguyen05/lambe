import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class ChatRoomInputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool canSend;
  final bool isSending;
  final VoidCallback onPickImage;
  final VoidCallback onSendMessage;

  const ChatRoomInputBar({
    super.key,
    required this.controller,
    required this.canSend,
    required this.isSending,
    required this.onPickImage,
    required this.onSendMessage,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        boxShadow: [
          BoxShadow(
            color: AppColors.onBackground.withValues(alpha: 0.05),
            offset: const Offset(0, -3),
            blurRadius: 10,
          ),
        ],
        border: const Border(
          top: BorderSide(color: AppColors.surfaceContainerHigh, width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: Material(
                  color: AppColors.primaryFixed.withValues(alpha: 0.25),
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: isSending ? null : onPickImage,
                    customBorder: const CircleBorder(),
                    child: const Center(
                      child: Icon(
                        Icons.add_photo_alternate_outlined,
                        size: 21,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 5,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.onBackground,
                    height: 1.35,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'Nhập tin nhắn tư vấn...',
                    hintStyle: const TextStyle(
                      fontSize: 13.5,
                      color: AppColors.textMuted,
                    ),
                    filled: true,
                    fillColor: AppColors.surface,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: const BorderSide(
                        color: AppColors.surfaceContainerHigh,
                        width: 1,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: BorderSide(
                        color: AppColors.outlineVariant.withValues(alpha: 0.4),
                        width: 1,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: const BorderSide(
                        color: AppColors.primary,
                        width: 1.4,
                      ),
                    ),
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 40,
                height: 40,
                child: Material(
                  color: canSend ? AppColors.primary : AppColors.surfaceContainerHigh,
                  shape: const CircleBorder(),
                  elevation: canSend ? 2 : 0,
                  shadowColor: AppColors.primary.withValues(alpha: 0.35),
                  child: InkWell(
                    onTap: canSend && !isSending ? onSendMessage : null,
                    customBorder: const CircleBorder(),
                    child: Center(
                      child: isSending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.onPrimary,
                              ),
                            )
                          : Icon(
                              Icons.arrow_upward_rounded,
                              size: 20,
                              color: canSend
                                  ? AppColors.onPrimary
                                  : AppColors.textMuted,
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
