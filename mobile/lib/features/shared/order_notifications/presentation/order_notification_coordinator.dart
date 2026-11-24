import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';

import './order_notifications_provider.dart';
import '../domain/order_notification.dart';

import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';

class OrderNotificationCoordinator extends ConsumerStatefulWidget {
  final Widget child;
  final GoRouter router;
  final GlobalKey<ScaffoldMessengerState> messengerKey;

  const OrderNotificationCoordinator({
    super.key,
    required this.child,
    required this.router,
    required this.messengerKey,
  });

  @override
  ConsumerState<OrderNotificationCoordinator> createState() =>
      _OrderNotificationCoordinatorState();
}

class _OrderNotificationCoordinatorState
    extends ConsumerState<OrderNotificationCoordinator>
    with WidgetsBindingObserver {
  final Set<String> _syncedNotificationIds = {};
  Timer? _timer;
  String? _userId;
  bool _canPoll = false;
  bool _foreground = true;
  bool _hasInitialSnapshot = false;
  final Set<String> _announcedCancellationIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _userId = ref.read(authNotifierProvider).valueOrNull?.id;
    _timer = Timer.periodic(const Duration(seconds: 45), (_) {
      final userId = _userId;
      if (_foreground && _canPoll && userId != null) {
        _refreshNotifications(userId);
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_foreground == foreground) return;
    setState(() => _foreground = foreground);
    if (foreground && _canPoll && _userId != null) {
      _refreshNotifications(_userId!);
    }
  }

  void _refreshNotifications(String userId) {
    final provider = orderNotificationsProvider(userId);
    if (!ref.read(provider).isLoading) {
      ref.invalidate(provider);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authNotifierProvider);
    final userId = auth.valueOrNull?.id;
    _canPoll = auth.hasValue && userId != null;

    ref.listen<String?>(
      authNotifierProvider.select((a) => a.valueOrNull?.id),
      (previousUserId, currentUserId) {
        if (previousUserId != currentUserId) {
          _userId = currentUserId;
          _syncedNotificationIds.clear();
          _announcedCancellationIds.clear();
          _hasInitialSnapshot = false;
        }
      },
    );

    if (_foreground && _canPoll && userId != null) {
      final items = ref.watch(orderNotificationsProvider(userId)).valueOrNull;
      if (items != null) {
        final initialSnapshot = !_hasInitialSnapshot;
        _hasInitialSnapshot = true;
        final newItems = items
            .where((item) => !_syncedNotificationIds.contains(item.id))
            .toList();
        if (newItems.isNotEmpty) {
          _syncedNotificationIds.addAll(newItems.map((item) => item.id));
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || _userId != userId || !_foreground) return;
            // Do not dispose the detail notifier: that would reset the screen and
            // lose the pending-to-accepted transition observed by its listener.
            if (newItems.any((item) => item.recipientRole == 'CUSTOMER')) {
              if (!initialSnapshot) {
                ref.invalidate(customerOrdersListProvider);
                for (final orderId
                    in newItems
                        .where((item) => item.recipientRole == 'CUSTOMER')
                        .map((item) => item.orderId)
                        .toSet()) {
                  if (!ref.exists(
                    customerOrderDetailNotifierProvider(orderId),
                  )) {
                    continue;
                  }
                  ref
                      .read(
                        customerOrderDetailNotifierProvider(orderId).notifier,
                      )
                      .fetchOrder(silent: true, queueIfBusy: true);
                }
              }
            }
            final providerOrderIds = newItems
                .where((item) => item.recipientRole == 'PROVIDER')
                .map((item) => item.orderId)
                .toSet();
            if (providerOrderIds.isNotEmpty) {
              if (!initialSnapshot) {
                if (ref.exists(providerOrdersListProvider)) {
                  ref.invalidate(providerOrdersListProvider);
                }
                for (final orderId in providerOrderIds) {
                  final signal = providerOrderRefreshSignalProvider(orderId);
                  if (ref.exists(signal)) {
                    ref.read(signal.notifier).state++;
                  }
                }
              }
            }
            for (final item in newItems) {
              if (item.recipientRole != 'CUSTOMER' ||
                  item.event != 'CANCELLATION_REQUESTED' ||
                  !item.isUnread ||
                  !_announcedCancellationIds.add(item.id)) {
                continue;
              }
              _showPendingCancellation(item, userId);
              break;
            }
          });
        }
      }
    }
    return widget.child;
  }

  Future<void> _showPendingCancellation(
    OrderNotification notification,
    String userId,
  ) async {
    try {
      final order = await ref
          .read(customerOrdersRepositoryProvider)
          .getMyOrderById(notification.orderId);
      if (!mounted ||
          !_foreground ||
          _userId != userId ||
          order.cancellationRequest?.status != 'PENDING_CUSTOMER') {
        return;
      }
      if (!mounted) return;
      final targetContext =
          widget.router.routerDelegate.navigatorKey.currentContext;
      if (targetContext != null && targetContext.mounted) {
        await AppDialog.warning(
          targetContext,
          title: 'Yêu cầu hủy đơn',
          message: 'Chuyên viên yêu cầu hủy đơn. Vui lòng xem và phản hồi.',
          buttonText: 'Xem yêu cầu',
          onPressed: () => widget.router.go(notification.destination),
        );
      } else {
        await AppDialog.warning(
          context,
          title: 'Yêu cầu hủy đơn',
          message: 'Chuyên viên yêu cầu hủy đơn. Vui lòng xem và phản hồi.',
          buttonText: 'Xem yêu cầu',
          onPressed: () => widget.router.go(notification.destination),
        );
      }
    } catch (_) {
      // The detail screen will still fetch the latest state when opened.
    }
  }
}
