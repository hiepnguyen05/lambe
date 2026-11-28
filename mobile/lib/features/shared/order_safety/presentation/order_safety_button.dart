import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../application/order_safety_controller.dart';
import '../domain/order_safety.dart';

class OrderSafetyButton extends ConsumerWidget {
  final SafetyScope scope;
  const OrderSafetyButton({super.key, required this.scope});

  Future<SafetyReason?> _confirmSos(BuildContext context) {
    var selectedReason = SafetyReason.threat;
    return showDialog<SafetyReason>(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Row(
            children: [
              Icon(Icons.sos_rounded, color: Color(0xFFDC2626)),
              SizedBox(width: 8),
              Text('Báo SOS khẩn cấp'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Đơn sẽ tạm dừng ngay để ưu tiên an toàn. Nếu đang gặp nguy hiểm tức thời, hãy rời khỏi tình huống và gọi khẩn cấp địa phương (113 / 115).',
                  style: TextStyle(fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final reason in SafetyReason.values)
                      ChoiceChip(
                        label: Text(reason.label),
                        selected: selectedReason == reason,
                        onSelected: (_) =>
                            setModalState(() => selectedReason = reason),
                      ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Quay lại'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
              ),
              onPressed: () => Navigator.pop(dialogCtx, selectedReason),
              child: const Text('Gửi SOS'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final safety = ref.watch(orderSafetyProvider(scope));
    return TextButton.icon(
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      onPressed: safety.busy
          ? null
          : () async {
              final reason = await _confirmSos(context);
              if (reason == null || !context.mounted) return;
              final controller = ref.read(orderSafetyProvider(scope).notifier);
              await controller.raise(reason: reason);
              if (context.mounted && controller.mounted) {
                final error = controller.errorMessage;
                if (error != null) {
                  await AppDialog.error(context, message: error);
                }
              }
            },
      icon: const Icon(Icons.gpp_maybe_rounded, color: Colors.red, size: 18),
      label: const Text(
        'SOS',
        style: TextStyle(color: Colors.red, fontWeight: FontWeight.w800),
      ),
    );
  }
}
