import 'package:flutter/material.dart';

import '../domain/payment_dispute_order.dart';

Future<String?> showPaymentDisputeReasonDialog(BuildContext context) =>
    showDialog<String>(context: context, builder: (_) => const _ReasonDialog());

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog();
  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _reason = TextEditingController();
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Báo chưa nhận đủ tiền'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Đơn sẽ chờ bộ phận hỗ trợ đối soát. Hoa hồng tiếp tục tạm giữ; chưa đánh dấu hoàn thành.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            maxLength: 500,
            maxLines: 3,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Mô tả tình huống (10–500 ký tự)',
              hintText: 'Ví dụ: Khách mới thanh toán một phần tiền mặt',
            ),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Quay lại'),
      ),
      FilledButton(
        onPressed: validatePaymentDisputeReason(_reason.text) != null
            ? null
            : () => Navigator.pop(context, _reason.text.trim()),
        child: const Text('Gửi yêu cầu đối soát'),
      ),
    ],
  );
  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }
}
