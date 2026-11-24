import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../domain/payment_dispute_order.dart';

/// Event payloads are hints; only an authenticated order read changes the UI.
class PaymentDisputeUpdates extends ConsumerStatefulWidget {
  final PaymentDisputeScope scope;
  final Future<void> Function() refreshOrder;
  const PaymentDisputeUpdates({
    super.key,
    required this.scope,
    required this.refreshOrder,
  });
  @override
  ConsumerState<PaymentDisputeUpdates> createState() =>
      _PaymentDisputeUpdatesState();
}

class _PaymentDisputeUpdatesState extends ConsumerState<PaymentDisputeUpdates>
    with WidgetsBindingObserver {
  final _events = <String>{};
  bool _foreground = true, _refreshing = false, _queued = false;
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
    _foreground = state == AppLifecycleState.resumed;
  }

  Future<void> _refresh() async {
    if (_refreshing) {
      _queued = true;
      return;
    }
    _refreshing = true;
    try {
      await widget.refreshOrder();
    } catch (_) {
      /* Keep the last snapshot; the order's polling remains the fallback. */
    } finally {
      _refreshing = false;
      if (_queued &&
          mounted &&
          _foreground &&
          ModalRoute.of(context)?.isCurrent == true) {
        _queued = false;
        unawaited(_refresh());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(orderNotificationEventsProvider, (_, value) {
      final event = value.valueOrNull;
      if (!_foreground ||
          ModalRoute.of(context)?.isCurrent != true ||
          event == null ||
          event.orderId != widget.scope.orderId ||
          event.recipientRole !=
              (widget.scope.role == PaymentDisputeRole.provider
                  ? 'PROVIDER'
                  : 'CUSTOMER') ||
          !event.event.startsWith('PAYMENT_DISPUTE_') ||
          !_events.add(event.id)) {
        return;
      }
      if (_events.length > 64) _events.remove(_events.first);
      unawaited(_refresh());
    });
    return const SizedBox.shrink();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
