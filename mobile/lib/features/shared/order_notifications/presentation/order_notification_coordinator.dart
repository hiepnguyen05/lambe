import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/routing/app_route_readiness.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';
import 'package:mobile/features/shared/order_add_ons/presentation/add_on_proposal_dialog.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/reschedule_time_picker.dart';

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
  final Set<String> _announcedAddOnIds = {};
  final Set<String> _announcedRescheduleIds = {};
  final List<OrderNotification> _promptQueue = [];
  bool _isPrompting = false;
  bool _routeRefreshScheduled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.router.routerDelegate.addListener(_scheduleRouteRefresh);
    _userId = ref.read(authNotifierProvider).valueOrNull?.id;
    _timer = Timer.periodic(const Duration(seconds: 45), (_) {
      final userId = _userId;
      if (_foreground && _canPoll && userId != null) {
        _refreshNotifications(userId);
      }
    });
  }

  bool _canPresentFor(String userId) {
    if (!mounted || !_foreground || !isAppContentReady(widget.router)) {
      return false;
    }
    final auth = ref.read(authNotifierProvider);
    return !auth.isLoading && auth.valueOrNull?.id == userId;
  }

  void _scheduleRouteRefresh() {
    if (!mounted || _routeRefreshScheduled) return;
    _routeRefreshScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _routeRefreshScheduled = false;
      if (!mounted) return;
      setState(() {});
      _resumeQueuedPrompts();
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _resumeQueuedPrompts() {
    final userId = _userId;
    if (!_isPrompting &&
        _promptQueue.isNotEmpty &&
        userId != null &&
        _canPresentFor(userId)) {
      unawaited(_drainPromptQueue(userId));
    }
  }

  bool _deferIfBlocked(OrderNotification notice, String userId) {
    if (_canPresentFor(userId)) return false;
    // Reconsider the notice on the next workspace build; do not mark it shown.
    _syncedNotificationIds.remove(notice.id);
    return true;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_foreground == foreground) return;
    setState(() => _foreground = foreground);
    if (foreground && _canPoll && _userId != null) {
      _refreshNotifications(_userId!);
    }
    if (foreground) _scheduleRouteRefresh();
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
    widget.router.routerDelegate.removeListener(_scheduleRouteRefresh);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authNotifierProvider);
    final userId = auth.valueOrNull?.id;
    _canPoll =
        !auth.isLoading &&
        auth.hasValue &&
        userId != null &&
        isAppContentReady(widget.router);

    ref.listen<String?>(authNotifierProvider.select((a) => a.valueOrNull?.id), (
      previousUserId,
      currentUserId,
    ) {
      if (previousUserId != currentUserId) {
        _userId = currentUserId;
        _syncedNotificationIds.clear();
        _announcedCancellationIds.clear();
        _announcedAddOnIds.clear();
        _announcedRescheduleIds.clear();
        _promptQueue.clear();
        _hasInitialSnapshot = false;
      }
    });

    ref.listen<AsyncValue<OrderNotification>>(orderNotificationEventsProvider, (
      _,
      next,
    ) {
      final notice = next.valueOrNull;
      if (_foreground && _canPoll && userId != null && notice != null) {
        _refreshNotifications(userId);
      }
    });

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
            if (!_canPresentFor(userId)) {
              _syncedNotificationIds.removeAll(newItems.map((item) => item.id));
              return;
            }
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
            final prompts = <OrderNotification>[];
            for (final item in newItems) {
              if (item.recipientRole == 'CUSTOMER' &&
                  item.isUnread &&
                  ((item.event == 'CANCELLATION_REQUESTED' &&
                          !_announcedCancellationIds.contains(item.id)) ||
                      (item.event == 'ORDER_ADD_ON_REQUESTED' &&
                          !_announcedAddOnIds.contains(item.id)) ||
                      (item.event == 'ORDER_RESCHEDULE_REQUESTED' &&
                          !_announcedRescheduleIds.contains(item.id)))) {
                prompts.add(item);
              }
            }
            if (prompts.isNotEmpty) {
              _enqueuePrompts(prompts);
            }
          });
        }
      }
    }
    if (_promptQueue.isNotEmpty &&
        !_isPrompting &&
        userId != null &&
        _canPresentFor(userId)) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _resumeQueuedPrompts(),
      );
    }
    return widget.child;
  }

  @override
  void didUpdateWidget(covariant OrderNotificationCoordinator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.router != widget.router) {
      oldWidget.router.routerDelegate.removeListener(_scheduleRouteRefresh);
      widget.router.routerDelegate.addListener(_scheduleRouteRefresh);
      _scheduleRouteRefresh();
    }
  }

  void _enqueuePrompts(List<OrderNotification> items) {
    for (final item in items) {
      if (_promptQueue.every((queued) => queued.id != item.id)) {
        _promptQueue.add(item);
      }
    }
    _resumeQueuedPrompts();
  }

  Future<void> _drainPromptQueue(String userId) async {
    _isPrompting = true;
    try {
      while (_promptQueue.isNotEmpty && _canPresentFor(userId)) {
        final item = _promptQueue.removeAt(0);
        if (item.event == 'CANCELLATION_REQUESTED') {
          await _showPendingCancellation(item, userId);
        } else if (item.event == 'ORDER_ADD_ON_REQUESTED') {
          await _showPendingAddOn(item, userId);
        } else if (item.event == 'ORDER_RESCHEDULE_REQUESTED') {
          await _showPendingReschedule(item, userId);
        }
        if (_promptQueue.isNotEmpty) {
          // A dialog action may navigate. Let the new page commit before the
          // next popup so replacing the old page cannot also remove that popup.
          await WidgetsBinding.instance.endOfFrame;
        }
      }
    } finally {
      _isPrompting = false;
    }
  }

  Future<void> _showPendingCancellation(
    OrderNotification notification,
    String userId,
  ) async {
    try {
      final order = await ref
          .read(customerOrdersRepositoryProvider)
          .getMyOrderById(notification.orderId);
      if (_deferIfBlocked(notification, userId)) return;
      if (order.cancellationRequest?.status != 'PENDING_CUSTOMER') {
        _announcedCancellationIds.add(notification.id);
        return;
      }
      final targetContext =
          widget.router.routerDelegate.navigatorKey.currentContext ?? context;
      if (!targetContext.mounted) return;
      _announcedCancellationIds.add(notification.id);
      await AppDialog.warning(
        targetContext,
        title: 'Yêu cầu hủy đơn',
        message: 'Chuyên viên yêu cầu hủy đơn. Vui lòng xem và phản hồi.',
        buttonText: 'Xem yêu cầu',
        onPressed: () => widget.router.go(notification.destination),
      );
    } catch (_) {
      // Allow the next poll cycle to retry fetching if this check failed due to network.
      _syncedNotificationIds.remove(notification.id);
    }
  }

  Future<void> _showPendingAddOn(
    OrderNotification notification,
    String userId,
  ) async {
    try {
      final order = await ref
          .read(customerOrdersRepositoryProvider)
          .getMyOrderById(notification.orderId);
      final now = DateTime.now();
      final pending =
          order.addOnSnapshot?.items
              .where((item) => item.pending(now))
              .toList() ??
          const [];
      if (_deferIfBlocked(notification, userId)) return;
      if (pending.isEmpty) {
        _announcedAddOnIds.add(notification.id);
        return;
      }
      final proposal = pending.first;
      final announced = ref.read(announcedAddOnProposalIdsProvider);
      if (announced.contains(proposal.id) ||
          AddOnProposalDialog.activeProposalId == proposal.id) {
        _announcedAddOnIds.add(notification.id);
        return;
      }
      final targetContext =
          widget.router.routerDelegate.navigatorKey.currentContext ?? context;
      if (!targetContext.mounted) return;
      _announcedAddOnIds.add(notification.id);
      await AddOnProposalDialog.show(
        targetContext,
        ref,
        scope: AddOnScope(order.id, AddOnRole.customer),
        currencyCode: order.currencyCode,
        proposal: proposal,
        onServerOrder: (json) {
          if (ref.exists(customerOrderDetailNotifierProvider(order.id))) {
            ref
                .read(customerOrderDetailNotifierProvider(order.id).notifier)
                .applyServerOrder(CustomerOrderEntity.fromJson(json));
          }
        },
        onAfterDecision: () async {
          await ref
              .read(orderNotificationsRemoteDataSourceProvider)
              .markRead(notification.id)
              .catchError((_) {});
          if (mounted) {
            ref.invalidate(customerOrdersListProvider);
            if (ref.exists(customerOrderDetailNotifierProvider(order.id))) {
              await ref
                  .read(customerOrderDetailNotifierProvider(order.id).notifier)
                  .fetchOrder(silent: true, queueIfBusy: true);
            }
          }
        },
      );
    } catch (_) {
      // Allow the next poll cycle to retry fetching if this check failed due to network.
      _syncedNotificationIds.remove(notification.id);
    }
  }

  Future<void> _showPendingReschedule(
    OrderNotification notification,
    String userId,
  ) async {
    try {
      final order = await ref
          .read(customerOrdersRepositoryProvider)
          .getMyOrderById(notification.orderId);
      final proposal = order.rescheduleRequest;
      final isPendingFromProvider =
          order.rescheduleSnapshot.eligible &&
          proposal != null &&
          proposal.isPending(DateTime.now()) &&
          proposal.requestedBy == RescheduleRole.provider;
      if (_deferIfBlocked(notification, userId)) return;
      if (!isPendingFromProvider) {
        _announcedRescheduleIds.add(notification.id);
        return;
      }
      final targetContext =
          widget.router.routerDelegate.navigatorKey.currentContext ?? context;
      if (!targetContext.mounted) return;
      _announcedRescheduleIds.add(notification.id);
      await AppDialog.info(
        targetContext,
        title: 'Đề xuất đổi giờ mới',
        message:
            'Chuyên viên đề xuất chuyển lịch sang ${rescheduleTimeLabel(proposal.startAt)} (giờ Việt Nam). Vui lòng xem và phản hồi.',
        buttonText: 'Xem đề xuất',
        onPressed: () {
          unawaited(
            ref
                .read(orderNotificationsRemoteDataSourceProvider)
                .markRead(notification.id)
                .catchError((_) {}),
          );
          widget.router.go(notification.destination);
        },
      );
    } catch (_) {
      // Allow the next poll cycle to retry fetching if this check failed due to network.
      _syncedNotificationIds.remove(notification.id);
    }
  }
}
