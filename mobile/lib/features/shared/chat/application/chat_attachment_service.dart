import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/network/upload_payload.dart';

class ProcessedChatAttachments {
  final List<UploadPayload> uploads;
  final List<String> oversizedFiles;

  const ProcessedChatAttachments({
    required this.uploads,
    required this.oversizedFiles,
  });
}

class ChatAttachmentService {
  static const int maxFileSizeInBytes = 5 * 1024 * 1024; // 5 MB
  static const int maxAttachments = 4;

  const ChatAttachmentService();

  Future<ProcessedChatAttachments> prepareUploads(
    List<XFile> files, {
    int maxCount = maxAttachments,
    int maxBytesPerFile = maxFileSizeInBytes,
  }) async {
    final uploads = <UploadPayload>[];
    final oversized = <String>[];

    for (final image in files.take(maxCount)) {
      final resolvedName = image.name.isNotEmpty
          ? image.name
          : (image.path.isNotEmpty
                ? image.path.split(RegExp(r'[/\\]')).last
                : 'attachment.jpg');

      final length = await image.length();
      if (length > maxBytesPerFile) {
        oversized.add(resolvedName);
        continue;
      }
      final bytes = await image.readAsBytes();
      uploads.add(UploadPayload(bytes: bytes, fileName: resolvedName));
    }

    return ProcessedChatAttachments(
      uploads: uploads,
      oversizedFiles: oversized,
    );
  }
}

final chatAttachmentServiceProvider = Provider<ChatAttachmentService>((ref) {
  return const ChatAttachmentService();
});
