import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';
import 'package:mobile/features/shared/order_add_ons/presentation/order_add_ons_section.dart';

import '../../../domain/entities/customer_order_entity.dart';
import '../../providers/customer_orders_providers.dart';

class CustomerOrderAddOns extends ConsumerWidget {
  final CustomerOrderEntity order;
  final bool mutationBlocked;
  const CustomerOrderAddOns({
    super.key,
    required this.order,
    this.mutationBlocked = false,
  });
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = order.addOnSnapshot;
    if (snapshot == null) return const SizedBox.shrink();
    return OrderAddOnsSection(
      scope: AddOnScope(order.id, AddOnRole.customer),
      snapshot: snapshot,
      mutationBlocked: mutationBlocked,
      onServerOrder: (json) => ref
          .read(customerOrderDetailNotifierProvider(order.id).notifier)
          .applyServerOrder(CustomerOrderEntity.fromJson(json)),
      refreshOrder: () async {
        await ref
            .read(customerOrderDetailNotifierProvider(order.id).notifier)
            .fetchOrder(silent: true, queueIfBusy: true);
        if (context.mounted) ref.invalidate(customerOrdersListProvider);
      },
    );
  }
}
