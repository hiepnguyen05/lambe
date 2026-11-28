import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/customer_order_entity.dart';
import 'package:mobile/core/widgets/order_status_badge.dart';

class OrderStatusTimeline extends StatelessWidget {
  final List<OrderStatusHistoryEntity> history;
  final String currentStatus;

  const OrderStatusTimeline({
    super.key,
    required this.history,
    required this.currentStatus,
  });

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Text(
          'Đang cập nhật lịch sử trạng thái...',
          style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
        ),
      );
    }

    final sorted = List<OrderStatusHistoryEntity>.from(history)
      ..sort((a, b) {
        if (a.createdAt == null) return 1;
        if (b.createdAt == null) return -1;
        return a.createdAt!.compareTo(b.createdAt!);
      });

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.timeline_rounded, size: 17, color: Color(0xFF0F766E)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Lịch sử tiến trình đơn',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: sorted.length,
            itemBuilder: (context, index) {
              final item = sorted[index];
              final isLast = index == sorted.length - 1;
              final timeStr = item.createdAt != null
                  ? DateFormat('HH:mm - dd/MM/yyyy').format(item.createdAt!)
                  : '';

              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isLast
                                ? const Color(0xFF0F766E)
                                : const Color(0xFFCBD5E1),
                            border: Border.all(
                              color: isLast
                                  ? const Color(0xFF99F6E4)
                                  : Colors.white,
                              width: 2,
                            ),
                          ),
                        ),
                        if (!isLast)
                          Expanded(
                            child: Container(
                              width: 1.5,
                              color: const Color(0xFFE2E8F0),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: double.infinity,
                              child: Wrap(
                                alignment: WrapAlignment.spaceBetween,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 8,
                                runSpacing: 4,
                                children: [
                                  OrderStatusBadge(
                                    status: item.toStatus,
                                    isCompact: true,
                                  ),
                                  if (timeStr.isNotEmpty)
                                    Text(
                                      timeStr,
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        color: Color(0xFF94A3B8),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            if (item.reason != null &&
                                item.reason!.trim().isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                'Lý do: ${item.reason!}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF64748B),
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
