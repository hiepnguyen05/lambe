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
    final isPending = item.pending(now);
    final (label, badgeBg, badgeFg) = switch (item.status) {
      'PENDING' when isPending => (
        'Chờ khách phản hồi',
        const Color(0xFFFEF3C7),
        const Color(0xFFB45309),
      ),
      'ACCEPTED' => (
        'Đã chấp nhận',
        const Color(0xFFD1FAE5),
        const Color(0xFF047857),
      ),
      'REJECTED' => (
        'Khách đã từ chối',
        const Color(0xFFFEE2E2),
        const Color(0xFFB91C1C),
      ),
      'CANCELLED' => (
        'Thợ đã rút đề nghị',
        const Color(0xFFF1F5F9),
        const Color(0xFF475569),
      ),
      _ => (
        'Đề nghị đã hết hạn',
        const Color(0xFFF1F5F9),
        const Color(0xFF475569),
      ),
    };

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isPending ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isPending ? const Color(0xFFFDE68A) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.serviceName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: badgeFg,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '+${addOnMoney(item.priceAmount, currency)} · ${item.durationMinutes} phút',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF005C55),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Tổng đơn nếu chấp nhận: ${addOnMoney(item.proposedTotalAmount, currency)}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
          ),
          if (provider) ...[
            const SizedBox(height: 2),
            Text(
              'Hoa hồng phát sinh: ${addOnMoney(item.commissionAmount, currency)}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
          if (item.note?.isNotEmpty == true) ...[
            const SizedBox(height: 2),
            Text(
              'Ghi chú: ${item.note}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
          if (isPending) ...[
            const SizedBox(height: 4),
            Text(
              'Hạn xác nhận: ${addOnTime(item.expiresAt)}',
              style: const TextStyle(fontSize: 11.5, color: Color(0xFFB45309)),
            ),
            const SizedBox(height: 10),
            if (provider)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: canAct ? onWithdraw : null,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF475569),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text('Rút đề nghị'),
                ),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: canAct ? onReject : null,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text('Từ chối'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: canAct ? onApprove : null,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF005C55),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text('Đồng ý thêm dịch vụ'),
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }
}
