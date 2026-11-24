import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';
import 'package:mobile/features/shared/order_add_ons/presentation/order_add_ons_section.dart';

import '../../../di/provider_workspace_providers.dart';

class ProviderOrderAddOns extends ConsumerWidget {
  final Map<String, dynamic> order;
  const ProviderOrderAddOns({super.key, required this.order});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!order.containsKey('addOns')) return const SizedBox.shrink();
    final snapshot = AddOnOrder.fromJson(order);
    return OrderAddOnsSection(
      scope: AddOnScope(snapshot.id, AddOnRole.provider),
      snapshot: snapshot,
      mutationBlocked: ref
          .watch(providerOrderExecutionNotifierProvider(snapshot.id))
          .isActionLoading,
      refreshOrder: () async {
        await ref
            .read(providerOrderExecutionNotifierProvider(snapshot.id).notifier)
            .fetchDetail(silent: true, queueIfBusy: true);
        if (context.mounted) ref.invalidate(providerOrdersListProvider);
      },
    );
  }
}
