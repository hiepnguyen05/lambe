import 'package:flutter/material.dart';

import '../domain/order_add_on.dart';
import 'add_on_format.dart';

class AddOnProposalTile extends StatelessWidget {
  final OrderAddOn item;
  final String currency;
  final bool provider, canAct;
  final DateTime now;
  final VoidCallback? onApprove, onReject, onWithdraw;
  const AddOnProposalTile({
    super.key,
    required this.item,
    required this.currency,
    required this.provider,
    required this.canAct,
    required this.now,
    this.onApprove,
    this.onReject,
    this.onWithdraw,
  });
  @override
  Widget build(BuildContext context) {
    final label = item.status == 'PENDING'
        ? (item.pending(now) ? 'Chờ khách phản hồi' : 'Đề nghị đã hết hạn')
        : switch (item.status) {
            'ACCEPTED' => 'Đã chấp nhận',
            'REJECTED' => 'Khách đã từ chối',
            'CANCELLED' => 'Thợ đã rút đề nghị',
            _ => 'Đề nghị đã hết hạn',
          };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.serviceName, style: Theme.of(context).textTheme.titleSmall),
          Text(label),
          Text(
            'Thêm ${addOnMoney(item.priceAmount, currency)} · ${item.durationMinutes} phút',
          ),
          Text(
            'Tổng đơn nếu chấp nhận: ${addOnMoney(item.proposedTotalAmount, currency)}',
          ),
          Text(
            'Kết thúc đề xuất: ${addOnTime(item.proposedEndAt)} (giờ Việt Nam)',
          ),
          if (provider)
            Text(
              'Hoa hồng phát sinh: ${addOnMoney(item.commissionAmount, currency)}',
            ),
          if (item.note?.isNotEmpty == true) Text('Ghi chú: ${item.note}'),
          if (item.pending(now)) ...[
            Text('Phản hồi trước: ${addOnTime(item.expiresAt)} (giờ Việt Nam)'),
            const Text(
              'Giá hiện tại chỉ thay đổi khi khách đồng ý. Không áp thêm phí di chuyển cho phần phát sinh.',
            ),
            if (provider)
              OutlinedButton(
                onPressed: canAct ? onWithdraw : null,
                child: const Text('Rút đề nghị'),
              )
            else
              Wrap(
                spacing: 12,
                children: [
                  OutlinedButton(
                    onPressed: canAct ? onReject : null,
                    child: const Text('Từ chối'),
                  ),
                  FilledButton(
                    onPressed: canAct ? onApprove : null,
                    child: const Text('Đồng ý thêm dịch vụ'),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }
}
