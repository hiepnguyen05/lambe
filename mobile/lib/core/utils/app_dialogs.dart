import 'package:flutter/material.dart';

class AppDialogs {
  static const _titleStyle = TextStyle(
    color: Color(0xFF0B1C30),
    fontWeight: FontWeight.bold,
    fontSize: 20,
  );
  static const _messageStyle = TextStyle(
    color: Color(0xFF3E4947),
    fontSize: 14,
    height: 1.5,
  );
  static const _buttonTextStyle = TextStyle(
    fontWeight: FontWeight.bold,
    fontSize: 16,
  );

  static Future<void> showMessageDialog(
    BuildContext context, {
    required String title,
    required String message,
    String buttonText = 'Đóng',
    VoidCallback? onPressed,
  }) async {
    await _show<void>(
      context,
      title: Text(title, style: _titleStyle, textAlign: TextAlign.center),
      message: message,
      actionsBuilder: (dialogContext) => [
        _fullWidthButton(
          text: buttonText,
          color: const Color(0xFF0F766E),
          onPressed: () {
            Navigator.of(dialogContext).pop();
            onPressed?.call();
          },
        ),
      ],
    );
  }

  static Future<void> showErrorDialog(
    BuildContext context, {
    String title = 'Đã có lỗi xảy ra',
    required String message,
  }) async {
    await _show<void>(
      context,
      title: Column(
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
          const SizedBox(height: 16),
          Text(title, style: _titleStyle, textAlign: TextAlign.center),
        ],
      ),
      message: message,
      actionsBuilder: (dialogContext) => [
        _fullWidthButton(
          text: 'Đóng',
          color: Colors.redAccent,
          onPressed: () => Navigator.of(dialogContext).pop(),
        ),
      ],
    );
  }

  static Future<bool?> showConfirmDialog(
    BuildContext context, {
    required String title,
    required String message,
    String confirmText = 'Xác nhận',
    String cancelText = 'Hủy',
  }) {
    return _show<bool>(
      context,
      title: Text(title, style: _titleStyle, textAlign: TextAlign.center),
      message: message,
      actionsBuilder: (dialogContext) => [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF3E4947),
                  side: const BorderSide(color: Color(0xFFBDC9C6)),
                  shape: const StadiumBorder(),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(cancelText, style: _buttonTextStyle),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                style: _filledButtonStyle(Colors.red),
                child: Text(confirmText, style: _buttonTextStyle),
              ),
            ),
          ],
        ),
      ],
    );
  }

  static Future<T?> _show<T>(
    BuildContext context, {
    required Widget title,
    required String message,
    required List<Widget> Function(BuildContext dialogContext) actionsBuilder,
  }) {
    return showDialog<T>(
      context: context,
      useRootNavigator: true,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: title,
        content: Text(
          message,
          style: _messageStyle,
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: actionsBuilder(dialogContext),
      ),
    );
  }

  static Widget _fullWidthButton({
    required String text,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: _filledButtonStyle(color),
        child: Text(text, style: _buttonTextStyle),
      ),
    );
  }

  static ButtonStyle _filledButtonStyle(Color color) {
    return ElevatedButton.styleFrom(
      backgroundColor: color,
      foregroundColor: Colors.white,
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(vertical: 14),
    );
  }
}
