import 'package:flutter/material.dart';

import '../domain/order_safety.dart';
import 'order_safety_screen.dart';

class OrderSafetyHistoryButton extends StatelessWidget {
  final SafetyScope scope;
  final Future<void> Function() refreshOrder;
  const OrderSafetyHistoryButton({
    super.key,
    required this.scope,
    required this.refreshOrder,
  });
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: 'Hồ sơ an toàn',
    icon: const Icon(Icons.health_and_safety_outlined),
    onPressed: () => Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            OrderSafetyScreen(scope: scope, refreshOrder: refreshOrder),
      ),
    ),
  );
}
