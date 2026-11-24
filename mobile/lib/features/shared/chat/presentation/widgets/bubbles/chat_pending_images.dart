import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:mobile/core/network/upload_payload.dart';

class ChatPendingImages extends StatelessWidget {
  final List<UploadPayload> images;

  const ChatPendingImages({super.key, required this.images});

  @override
  Widget build(BuildContext context) {
    if (images.isEmpty) {
      return const AspectRatio(
        aspectRatio: 1,
        child: ColoredBox(
          color: Color(0xFFE2E8F0),
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Ảnh không còn trong bộ nhớ. Vui lòng chọn ảnh và gửi lại.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B)),
              ),
            ),
          ),
        ),
      );
    }
    if (images.length == 1) return _PendingImageTile(image: images.single);
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 3,
      mainAxisSpacing: 3,
      children: [
        for (final image in images)
          _PendingImageTile(key: ObjectKey(image), image: image),
      ],
    );
  }
}

class _PendingImageTile extends StatefulWidget {
  final UploadPayload image;

  const _PendingImageTile({super.key, required this.image});

  @override
  State<_PendingImageTile> createState() => _PendingImageTileState();
}

class _PendingImageTileState extends State<_PendingImageTile> {
  late ImageProvider _image;

  void _setImage() {
    final bytes = widget.image.bytes;
    _image = ResizeImage.resizeIfNeeded(
      400,
      400,
      MemoryImage(bytes is Uint8List ? bytes : Uint8List.fromList(bytes)),
    );
  }

  @override
  void initState() {
    super.initState();
    _setImage();
  }

  @override
  void didUpdateWidget(covariant _PendingImageTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.image, widget.image)) {
      unawaited(_image.evict());
      _setImage();
    }
  }

  @override
  void dispose() {
    // MemoryImage keys also retain upload bytes in Flutter's global cache.
    unawaited(_image.evict());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image(
          image: _image,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const ColoredBox(
            color: Color(0xFFE2E8F0),
            child: Icon(Icons.broken_image_outlined, color: Color(0xFF64748B)),
          ),
        ),
      ),
    );
  }
}
