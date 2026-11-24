import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../application/service_operation.dart';
import '../../di/provider_services_providers.dart';
import '../../domain/service_change.dart';
import 'service_document_viewer.dart';

class ServiceChangeDocuments extends ConsumerWidget {
  final ServiceChange request;
  final bool disabled;
  const ServiceChangeDocuments({
    super.key,
    required this.request,
    required this.disabled,
  });
  Future<void> _pick(BuildContext context, WidgetRef ref, String type) async {
    try {
      await ref
          .read(serviceChangeProvider(request.id).notifier)
          .pickAndUpload(
            type,
            () => ImagePicker().pickImage(
              source: ImageSource.gallery,
              maxWidth: 1920,
              maxHeight: 1920,
              imageQuality: 85,
            ),
          );
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(serviceError(error))));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Tài liệu cho đề xuất (${request.documents.length}/10)',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Text(
            'Chứng chỉ và ảnh sản phẩm chỉ phục vụ kiểm duyệt, không tự đăng công khai. Ảnh JPEG/PNG/WEBP/GIF, tối đa 5 MB/ảnh.',
          ),
          for (final doc in request.documents)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(doc.label),
              subtitle: Text(switch (doc.status) {
                'VERIFIED' => 'Đã xác minh',
                'REJECTED' => 'Không hợp lệ',
                _ => 'Chờ xem xét',
              }),
              onTap: disabled
                  ? null
                  : () => showServiceDocument(context, request.id, doc.id),
              trailing: request.editable
                  ? IconButton(
                      tooltip: 'Xóa tài liệu',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: disabled
                          ? null
                          : () async {
                              final confirmed = await showDialog<bool>(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: const Text('Xóa tài liệu này?'),
                                  content: const Text(
                                    'Bạn có thể tải lại tài liệu đúng trước khi gửi kiểm duyệt.',
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () =>
                                          Navigator.pop(context, false),
                                      child: const Text('Giữ lại'),
                                    ),
                                    FilledButton(
                                      onPressed: () =>
                                          Navigator.pop(context, true),
                                      child: const Text('Xóa'),
                                    ),
                                  ],
                                ),
                              );
                              if (confirmed == true && context.mounted) {
                                await ref
                                    .read(
                                      serviceChangeProvider(request.id)
                                          .notifier,
                                    )
                                    .remove(doc.id);
                              }
                            },
                    )
                  : const Icon(Icons.visibility_outlined),
            ),
          if (request.editable) ...[
            OutlinedButton.icon(
              onPressed: disabled || request.documents.length >= 10
                  ? null
                  : () => _pick(context, ref, 'PROFESSIONAL_CERTIFICATE'),
              icon: const Icon(Icons.workspace_premium_outlined),
              label: const Text('Tải chứng chỉ nghề'),
            ),
            OutlinedButton.icon(
              onPressed: disabled || request.documents.length >= 10
                  ? null
                  : () => _pick(context, ref, 'PORTFOLIO'),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Tải ảnh sản phẩm'),
            ),
          ],
        ],
      ),
    ),
  );
}
