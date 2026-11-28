import 'package:flutter/material.dart';

import '../domain/add_on_order.dart';
import 'add_on_format.dart';

class AddOnLineItems extends StatelessWidget {
  final AddOnOrder order;
  final bool provider;

  const AddOnLineItems({super.key, required this.order, this.provider = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in order.accepted)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${item.serviceName} · ${item.durationMinutes} phút · đã chấp nhận',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF334155),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '+${addOnMoney(item.priceAmount, order.currencyCode)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF005C55),
                  ),
                ),
              ],
            ),
          ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Text(
                'Tổng đơn (${order.durationMinutes} phút)',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                addOnMoney(order.totalAmount, order.currencyCode),
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
