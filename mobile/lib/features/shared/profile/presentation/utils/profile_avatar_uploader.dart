import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:mobile/core/network/upload_payload.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

/// Mở bộ chọn ảnh từ thư viện, xem trước và tải lên ảnh đại diện tài khoản.
Future<void> pickAndUploadProfileAvatar(
  BuildContext context,
  WidgetRef ref,
) async {
  final picker = ImagePicker();
  final image = await picker.pickImage(
    source: ImageSource.gallery,
    maxWidth: 1024,
    maxHeight: 1024,
    imageQuality: 85,
  );
  if (image == null || !context.mounted) return;

  final imageBytes = await image.readAsBytes();
  if (!context.mounted) return;
  if (imageBytes.lengthInBytes > 5 * 1024 * 1024) {
    await AppDialog.showErrorDialog(
      context,
      message: 'Ảnh đại diện vượt quá giới hạn 5 MB. Vui lòng chọn ảnh nhỏ hơn.',
    );
    return;
  }

  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text(
        'Xem trước ảnh đại diện',
        textAlign: TextAlign.center,
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: ClipOval(
              child: Image.memory(
                imageBytes,
                width: 140,
                height: 140,
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Bạn có muốn sử dụng ảnh này làm ảnh đại diện?',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.black54),
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          ),
          child: const Text(
            'Hủy',
            style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
          ),
        ),
        ElevatedButton(
          onPressed: () async {
            Navigator.pop(ctx);
            await ref
                .read(authNotifierProvider.notifier)
                .uploadAvatar(
                  UploadPayload(bytes: imageBytes, fileName: image.name),
                );
            if (context.mounted) {
              final error = ref.read(authNotifierProvider).error;
              if (error == null) {
                AppDialog.showMessageDialog(
                  context,
                  title: 'Thành công',
                  message: 'Cập nhật ảnh đại diện thành công!',
                );
              } else {
                AppDialog.showErrorDialog(
                  context,
                  message: error.toString(),
                );
              }
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(100),
            ),
          ),
          child: const Text(
            'Lưu ảnh',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    ),
  );
}
