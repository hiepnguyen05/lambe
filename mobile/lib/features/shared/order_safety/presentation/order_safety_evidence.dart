import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../application/order_safety_controller.dart';
import '../domain/order_safety.dart';

class OrderSafetyEvidence extends ConsumerStatefulWidget {
  final SafetyScope scope;
  const OrderSafetyEvidence({super.key, required this.scope});
  @override
  ConsumerState<OrderSafetyEvidence> createState() =>
      _OrderSafetyEvidenceState();
}

class _OrderSafetyEvidenceState extends ConsumerState<OrderSafetyEvidence> {
  Future<void> _pick() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('Chụp ảnh'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              title: const Text('Chọn ảnh'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;
    try {
      final file = await ImagePicker().pickImage(source: source);
      if (file == null || !mounted) return;
      await ref.read(orderSafetyProvider(widget.scope).notifier).upload(file);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Chưa chọn được ảnh. Vui lòng thử lại.'),
          ),
        );
      }
    }
  }

  Future<void> _view(String id) async {
    try {
      final url = await ref
          .read(orderSafetyProvider(widget.scope).notifier)
          .evidenceUrl(id);
      if (!mounted) return;
      final image = ResizeImage.resizeIfNeeded(1080, null, NetworkImage(url));
      try {
        await showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Bằng chứng của bạn'),
            content: SizedBox(
              width: 320,
              height: 380,
              child: Image(
                image: image,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Text(
                  'Ảnh chưa tải được hoặc liên kết đã hết hạn. Đóng và mở lại để lấy liên kết mới.',
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Đóng'),
              ),
            ],
          ),
        );
      } finally {
        await image.evict();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Chưa xem được ảnh riêng tư. Vui lòng thử lại.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(orderSafetyProvider(widget.scope));
    final incident = state.incident;
    if (incident == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Ảnh bạn đã cung cấp'),
        for (var index = 0; index < incident.evidenceIds.length; index++)
          TextButton(
            onPressed: state.busy
                ? null
                : () => _view(incident.evidenceIds[index]),
            child: Text('Xem ảnh ${index + 1}'),
          ),
        if (incident.isOpen &&
            incident.ownReport &&
            incident.evidenceIds.length < 5)
          OutlinedButton.icon(
            onPressed: state.busy ? null : _pick,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: const Text('Bổ sung ảnh khi đã an toàn'),
          ),
        const Text(
          'Ảnh riêng tư, tối đa 5 ảnh và 5 MB mỗi ảnh. Không yêu cầu ảnh để gửi SOS.',
        ),
      ],
    );
  }
}
