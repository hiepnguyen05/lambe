import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

/// Copies [link] to clipboard and opens the native share sheet.
Future<void> shareAppLink(
  BuildContext context, {
  required String title,
  required String link,
  String? copiedMessage,
}) async {
  final box = context.findRenderObject() as RenderBox?;
  await Clipboard.setData(ClipboardData(text: link));
  try {
    await SharePlus.instance.share(
      ShareParams(
        text: '$title\n$link',
        sharePositionOrigin: box == null
            ? null
            : box.localToGlobal(Offset.zero) & box.size,
      ),
    );
  } catch (_) {
    if (context.mounted && copiedMessage != null) {
      await AppDialog.info(context, message: copiedMessage);
    }
  }
}
