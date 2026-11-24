import 'package:flutter/material.dart';

import '../domain/add_on_order.dart';
import 'add_on_format.dart';

class AddOnLineItems extends StatelessWidget {
  final AddOnOrder order;
  final bool provider;
  const AddOnLineItems({super.key, required this.order, this.provider = false});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('Dịch vụ gốc', style: Theme.of(context).textTheme.labelLarge),
      _line(
        '${order.serviceName} · giá gốc',
        addOnMoney(order.servicePriceAmount, order.currencyCode),
      ),
      for (final item in order.accepted)
        _line(
          '${item.serviceName} · ${item.durationMinutes} phút · đã chấp nhận',
          addOnMoney(item.priceAmount, order.currencyCode),
        ),
      const Divider(),
      _line(
        'Tổng đơn hiện tại',
        addOnMoney(order.totalAmount, order.currencyCode),
      ),
      Text('Tổng thời lượng: ${order.durationMinutes} phút'),
      if (order.expectedEndAt != null)
        Text(
          'Kết thúc dự kiến: ${addOnTime(order.expectedEndAt!)} (giờ Việt Nam)',
        ),
      if (provider && order.commissionAmount != null)
        Text(
          'Tổng hoa hồng của đơn: ${addOnMoney(order.commissionAmount!, order.currencyCode)}',
        ),
      const Text('Tổng đơn đã bao gồm phí và ưu đãi theo thông tin máy chủ.'),
    ],
  );
  Widget _line(String name, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(name)),
        const SizedBox(width: 12),
        Flexible(child: Text(value, textAlign: TextAlign.end)),
      ],
    ),
  );
}
