import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';
import 'package:mobile/features/shared/order_add_ons/presentation/add_on_proposal_dialog.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../../../domain/entities/customer_order_entity.dart';
import '../../providers/customer_orders_providers.dart';

/// Điều phối dịch vụ phát sinh phía khách hàng chỉ qua Dialog popup
/// (không hiển thị thẻ thông báo phát sinh lặp lại bên dưới màn hình).
class CustomerOrderAddOns extends ConsumerStatefulWidget {
  final CustomerOrderEntity order;
  final bool mutationBlocked;

  const CustomerOrderAddOns({
    super.key,
    required this.order,
    this.mutationBlocked = false,
  });

  @override
  ConsumerState<CustomerOrderAddOns> createState() =>
      _CustomerOrderAddOnsState();
}

class _CustomerOrderAddOnsState extends ConsumerState<CustomerOrderAddOns>
    with WidgetsBindingObserver {
  bool _foreground = true;
  final _events = <String>{};

  @override
  void initState() {
    super.initState();
    _foreground =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_foreground != foreground) setState(() => _foreground = foreground);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refreshOrder() async {
    if (!mounted) return;
    await ref
        .read(customerOrderDetailNotifierProvider(widget.order.id).notifier)
        .fetchOrder(silent: true, queueIfBusy: true);
    if (mounted) ref.invalidate(customerOrdersListProvider);
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = widget.order.addOnSnapshot;
    if (snapshot == null) return const SizedBox.shrink();

    if (_foreground && ModalRoute.of(context)?.isCurrent == true) {
      ref.listen(orderNotificationEventsProvider, (_, value) {
        final event = value.valueOrNull;
        if (!_foreground ||
            ModalRoute.of(context)?.isCurrent != true ||
            event == null ||
            event.orderId != widget.order.id ||
            event.recipientRole != 'CUSTOMER' ||
            !event.event.startsWith('ORDER_ADD_ON_') ||
            !_events.add(event.id)) {
          return;
        }
        if (_events.length > 64) _events.remove(_events.first);
        unawaited(_refreshOrder());
      });

      final now = DateTime.now();
      OrderAddOn? pendingProposal;
      for (final item in snapshot.items) {
        if (item.pending(now)) {
          pendingProposal = item;
          break;
        }
      }

      if (pendingProposal != null && !widget.mutationBlocked) {
        final announced = ref.read(announcedAddOnProposalIdsProvider);
        final target = pendingProposal;
        if (!announced.contains(target.id) &&
            AddOnProposalDialog.activeProposalId != target.id) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted ||
                !_foreground ||
                ModalRoute.of(context)?.isCurrent != true) {
              return;
            }
            if (ref.read(announcedAddOnProposalIdsProvider).contains(target.id) ||
                AddOnProposalDialog.activeProposalId == target.id) {
              return;
            }
            unawaited(
              AddOnProposalDialog.show(
                context,
                ref,
                scope: AddOnScope(widget.order.id, AddOnRole.customer),
                currencyCode: snapshot.currencyCode,
                proposal: target,
                onServerOrder: (json) {
                  if (mounted) {
                    ref
                        .read(
                          customerOrderDetailNotifierProvider(
                            widget.order.id,
                          ).notifier,
                        )
                        .applyServerOrder(CustomerOrderEntity.fromJson(json));
                  }
                },
                onAfterDecision: _refreshOrder,
              ),
            );
          });
        }
      }
    }

    return const SizedBox.shrink();
  }
}
