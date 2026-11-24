import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/order_safety_controller.dart';
import '../domain/order_safety.dart';

class OrderSafetyButton extends ConsumerWidget {
  final SafetyScope scope;
  const OrderSafetyButton({super.key, required this.scope});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final safety = ref.watch(orderSafetyProvider(scope));
    return TextButton.icon(
      onPressed: safety.busy
          ? null
          : () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Gửi SOS an toàn?'),
                  content: const Text(
                    'Dùng khi có nguy cơ tới người hoặc tài sản. Đơn sẽ tạm dừng để chờ hỗ trợ. Nếu đang gặp nguy hiểm, hãy ưu tiên rời khỏi tình huống và liên hệ dịch vụ khẩn cấp tại nơi bạn đang ở.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Quay lại'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Gửi SOS'),
                    ),
                  ],
                ),
              );
              if (confirmed != true || !context.mounted) return;
              final messenger = ScaffoldMessenger.of(context);
              final controller = ref.read(orderSafetyProvider(scope).notifier);
              await controller.raise();
              if (messenger.mounted && controller.mounted) {
                final error = controller.errorMessage;
                if (error != null) {
                  messenger.showSnackBar(SnackBar(content: Text(error)));
                }
              }
            },
      icon: const Icon(Icons.sos_rounded, color: Colors.red),
      label: const Text('SOS', style: TextStyle(color: Colors.red)),
    );
  }
}
