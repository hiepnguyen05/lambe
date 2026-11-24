import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

/// Hộp thoại dùng chung. Giữ API tĩnh để nơi gọi không phải tự lặp lại
/// cách đóng dialog và gọi callback.
class AppDialog {
  const AppDialog._();

  static Future<void> showMessageDialog(
    BuildContext context, {
    String title = 'Thông báo',
    required String message,
    String buttonText = 'Đóng',
    VoidCallback? onPressed,
  }) => info(
    context,
    title: title,
    message: message,
    buttonText: buttonText,
    onPressed: onPressed,
  );

  static Future<void> showErrorDialog(
    BuildContext context, {
    String title = 'Đã có lỗi xảy ra',
    required String message,
    String buttonText = 'Đóng',
    VoidCallback? onPressed,
  }) => error(
    context,
    title: title,
    message: message,
    buttonText: buttonText,
    onPressed: onPressed,
  );

  static Future<void> showSuccessDialog(
    BuildContext context, {
    String title = 'Thành công',
    String? message,
    String buttonText = 'Đồng ý',
    VoidCallback? onPressed,
  }) => success(
    context,
    title: title,
    message: message,
    buttonText: buttonText,
    onPressed: onPressed,
  );

  static Future<void> showWarningDialog(
    BuildContext context, {
    String title = 'Cảnh báo',
    String? message,
    String buttonText = 'Đã hiểu',
    VoidCallback? onPressed,
  }) => warning(
    context,
    title: title,
    message: message,
    buttonText: buttonText,
    onPressed: onPressed,
  );

  static Future<bool> showConfirmDialog(
    BuildContext context, {
    String title = 'Xác nhận',
    required String message,
    String confirmText = 'Xác nhận',
    String cancelText = 'Hủy',
    bool isDestructive = false,
  }) => confirm(
    context,
    title: title,
    message: message,
    confirmText: confirmText,
    cancelText: cancelText,
    isDestructive: isDestructive,
  );

  static Future<bool> confirm(
    BuildContext context, {
    String title = 'Xác nhận',
    String? message,
    Widget? content,
    String confirmText = 'Xác nhận',
    String cancelText = 'Hủy',
    bool isDestructive = false,
    bool barrierDismissible = true,
    TextAlign messageTextAlign = TextAlign.center,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: barrierDismissible,
      useRootNavigator: true,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(
          isDestructive
              ? Icons.delete_outline_rounded
              : Icons.help_outline_rounded,
          color: isDestructive ? AppColors.error : AppColors.primary,
        ),
        title: Text(title, textAlign: TextAlign.center),
        content: _content(message, content, messageTextAlign),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(cancelText),
          ),
          FilledButton(
            style: isDestructive
                ? FilledButton.styleFrom(backgroundColor: AppColors.error)
                : null,
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(confirmText),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  static Future<void> success(
    BuildContext context, {
    String title = 'Thành công',
    String? message,
    Widget? content,
    String buttonText = 'Đồng ý',
    VoidCallback? onPressed,
    bool barrierDismissible = true,
  }) => _notice(
    context,
    title: title,
    message: message,
    content: content,
    buttonText: buttonText,
    onPressed: onPressed,
    barrierDismissible: barrierDismissible,
    icon: Icons.check_circle_rounded,
    color: const Color(0xFF059669),
  );

  static Future<void> error(
    BuildContext context, {
    String title = 'Đã có lỗi xảy ra',
    required String message,
    Widget? content,
    String buttonText = 'Đóng',
    VoidCallback? onPressed,
    bool barrierDismissible = true,
  }) => _notice(
    context,
    title: title,
    message: message,
    content: content,
    buttonText: buttonText,
    onPressed: onPressed,
    barrierDismissible: barrierDismissible,
    icon: Icons.error_rounded,
    color: AppColors.error,
  );

  static Future<void> warning(
    BuildContext context, {
    String title = 'Cảnh báo',
    String? message,
    Widget? content,
    String buttonText = 'Đã hiểu',
    VoidCallback? onPressed,
    bool barrierDismissible = true,
  }) => _notice(
    context,
    title: title,
    message: message,
    content: content,
    buttonText: buttonText,
    onPressed: onPressed,
    barrierDismissible: barrierDismissible,
    icon: Icons.warning_amber_rounded,
    color: const Color(0xFFD97706),
  );

  static Future<void> info(
    BuildContext context, {
    String title = 'Thông báo',
    String? message,
    Widget? content,
    String buttonText = 'Đóng',
    VoidCallback? onPressed,
    bool barrierDismissible = true,
  }) => _notice(
    context,
    title: title,
    message: message,
    content: content,
    buttonText: buttonText,
    onPressed: onPressed,
    barrierDismissible: barrierDismissible,
    icon: Icons.info_outline_rounded,
    color: AppColors.primary,
  );

  static Future<void> _notice(
    BuildContext context, {
    required String title,
    required String buttonText,
    required IconData icon,
    required Color color,
    String? message,
    Widget? content,
    VoidCallback? onPressed,
    bool barrierDismissible = true,
  }) => showDialog<void>(
    context: context,
    barrierDismissible: barrierDismissible,
    useRootNavigator: true,
    builder: (dialogContext) => AlertDialog(
      icon: Icon(icon, color: color),
      title: Text(title, textAlign: TextAlign.center),
      content: _content(message, content, TextAlign.center),
      actions: [
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: color),
          onPressed: () {
            Navigator.of(dialogContext).pop();
            onPressed?.call();
          },
          child: Text(buttonText),
        ),
      ],
    ),
  );

  static Widget? _content(
    String? message,
    Widget? content,
    TextAlign messageTextAlign,
  ) {
    if ((message == null || message.isEmpty) && content == null) return null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (message != null && message.isNotEmpty)
          Text(message, textAlign: messageTextAlign),
        if (message != null && message.isNotEmpty && content != null)
          const SizedBox(height: 12),
        if (content != null) content,
      ],
    );
  }
}
