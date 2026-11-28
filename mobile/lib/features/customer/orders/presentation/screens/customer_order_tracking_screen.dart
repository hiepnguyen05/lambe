import 'package:flutter/material.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import 'package:mobile/core/routing/app_route_observer.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/order_countdown.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/order_reschedule_card.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_button.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_screen.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_screen.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_updates.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';
import 'package:mobile/features/shared/tracking/presentation/order_tracking_provider.dart';

import '../../domain/entities/customer_order_entity.dart';
import '../controllers/customer_order_action_coordinator.dart';
import '../providers/customer_orders_providers.dart';
import '../widgets/cancellation/order_cancellation_decision_card.dart';
import '../widgets/cancellation/order_cancellation_status_banner.dart';
import '../widgets/detail/customer_order_add_ons.dart';
import '../widgets/detail/customer_order_evidence_card.dart';
import '../widgets/detail/customer_order_provider_card.dart';
import '../widgets/tracking/customer_order_live_map.dart';
import '../widgets/tracking/customer_order_tracking_cards.dart';

class CustomerOrderTrackingScreen extends ConsumerStatefulWidget {
  final String orderId;

  const CustomerOrderTrackingScreen({super.key, required this.orderId});

  @override
  ConsumerState<CustomerOrderTrackingScreen> createState() =>
      _CustomerOrderTrackingScreenState();
}

class _CustomerOrderTrackingScreenState
    extends ConsumerState<CustomerOrderTrackingScreen>
    with
        SingleTickerProviderStateMixin,
        WidgetsBindingObserver,
        RouteAware,
        RouteVisibility {
  late final MapController _mapController;
  late final AnimationController _pulseController;
  bool _trackingActive = true;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  @override
  void onVisibilityChanged(bool active) {
    final notifier = ref.read(
      customerOrderDetailNotifierProvider(widget.orderId).notifier,
    );
    if (active) {
      notifier.resumePolling(this);
    } else {
      notifier.pausePolling(this);
      _pulseController.stop();
    }
    // Defer provider and widget state mutations out of Navigator's build/transition phase.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final isVisible = active && (ModalRoute.of(context)?.isCurrent ?? true);
      ref.read(orderTrackingActiveProvider(widget.orderId).notifier).state =
          isVisible;
      if (isVisible != _trackingActive) {
        setState(() => _trackingActive = isVisible);
      }
    });
  }

  void _handleBack() {
    final router = GoRouter.maybeOf(context);
    if (router != null) {
      if (router.canPop()) {
        router.pop();
      } else {
        router.go('/appointments');
      }
      return;
    }
    Navigator.of(context).maybePop();
  }

  Widget _wrapBackGuard(Widget child) {
    final router = GoRouter.maybeOf(context);
    if (router == null) return child;
    return PopScope(
      canPop: router.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) router.go('/appointments');
      },
      child: child,
    );
  }

  LatLng? _getCustomerLatLng(CustomerOrderEntity order) {
    if (order.addressLatitude != null && order.addressLongitude != null) {
      return LatLng(order.addressLatitude!, order.addressLongitude!);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(
      customerOrderDetailNotifierProvider(widget.orderId),
    );
    final notifier = ref.read(
      customerOrderDetailNotifierProvider(widget.orderId).notifier,
    );

    if (state.isLoading && state.order == null) {
      return _wrapBackGuard(
        Scaffold(
          backgroundColor: AppColors.surface,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(
                Icons.arrow_back_rounded,
                color: AppColors.onBackground,
              ),
              onPressed: _handleBack,
            ),
            title: const Text(
              'Theo dõi tiến trình',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.onBackground,
              ),
            ),
            backgroundColor: AppColors.surfaceContainerLowest,
            elevation: 0,
          ),
          body: const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
        ),
      );
    }

    if (state.errorMessage != null && state.order == null) {
      return _wrapBackGuard(
        Scaffold(
          backgroundColor: AppColors.surface,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(
                Icons.arrow_back_rounded,
                color: AppColors.onBackground,
              ),
              onPressed: _handleBack,
            ),
            title: const Text(
              'Theo dõi tiến trình',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.onBackground,
              ),
            ),
            backgroundColor: AppColors.surfaceContainerLowest,
            elevation: 0,
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 48,
                    color: AppColors.error,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    state.errorMessage!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textMuted,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => notifier.fetchOrder(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.onPrimary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final order = state.order!;
    final safetyScope = SafetyScope(widget.orderId, SafetyRole.customer);
    final safety = ref.watch(orderSafetyProvider(safetyScope));
    if (order.isSafetyHold || safety.blocksOrder) {
      _pulseController.stop();
      return OrderSafetyScreen(
        scope: safetyScope,
        refreshOrder: () =>
            notifier.fetchOrder(silent: true, queueIfBusy: true),
      );
    }

    final paymentScope = PaymentDisputeScope(
      widget.orderId,
      PaymentDisputeRole.customer,
    );
    Future<void> refreshPayment() async {
      await notifier.fetchOrder(silent: true, queueIfBusy: true);
      if (mounted) ref.invalidate(customerOrdersListProvider);
    }

    if (order.isPaymentDispute) {
      _pulseController.stop();
      return PaymentDisputeScreen(
        scope: paymentScope,
        snapshot: order.paymentDispute!,
        refreshOrder: refreshPayment,
        error: state.errorMessage,
      );
    }

    final customerLatLng = _getCustomerLatLng(order);
    final tracking = order.isEnRoute && _trackingActive
        ? ref.watch(orderTrackingProvider(order.id)).valueOrNull
        : null;
    if (_trackingActive &&
        order.isEnRoute &&
        tracking?.hasFreshPosition == true) {
      if (!_pulseController.isAnimating) _pulseController.repeat(reverse: true);
    } else {
      _pulseController.stop();
    }

    return _wrapBackGuard(
      GuidanceTrigger(
        tourId: order.isCompleted ? 'customer_review' : 'customer_tracking',
        enabled:
            !order.isPending &&
            !state.isCancelling &&
            (order.isActive || order.isCompleted),
        child: Scaffold(
          backgroundColor: AppColors.surface,
          appBar: AppBar(
            backgroundColor: AppColors.surfaceContainerLowest,
            elevation: 0.5,
            titleSpacing: 0,
            leading: IconButton(
              icon: const Icon(
                Icons.arrow_back_rounded,
                color: AppColors.onBackground,
              ),
              onPressed: _handleBack,
            ),
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        'Đơn #${order.id.length > 8 ? order.id.substring(0, 8).toUpperCase() : order.id}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.onBackground,
                        ),
                      ),
                    ),
                    if (order.isEnRoute &&
                        tracking?.hasFreshPosition == true) ...[
                      const SizedBox(width: 6),
                      _LivePulseBadge(pulseController: _pulseController),
                    ],
                  ],
                ),
                const SizedBox(height: 1),
                _OrderStatusSubtitle(order: order),
              ],
            ),
            actions: [
              if (canRaiseSafety(order.status, role: safetyScope.role))
                OrderSafetyButton(scope: safetyScope),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(
                  Icons.receipt_long_outlined,
                  color: AppColors.primary,
                ),
                tooltip: 'Xem chi tiết đơn',
                onPressed: () => context.push('/appointments/${order.id}'),
              ),
              const SizedBox(width: 4),
            ],
          ),
          body: GuidanceAnchor(
            id: 'customer_order',
            child: Column(
              children: [
                if (!order.isPending &&
                    !order.isCancelled &&
                    !order.isRejected &&
                    !order.isExpired)
                  CustomerOrderTrackingStepper(order: order),
                Expanded(
                  child: order.isEnRoute
                      ? _buildEnRouteMapLayout(
                          order: order,
                          customerLatLng: customerLatLng,
                          tracking: tracking,
                          paymentScope: paymentScope,
                          refreshPayment: refreshPayment,
                          mutationBlocked: state.isCancelling,
                        )
                      : _buildCleanProgressLayout(
                          order: order,
                          paymentScope: paymentScope,
                          refreshPayment: refreshPayment,
                          mutationBlocked: state.isCancelling,
                        ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: !order.isEnRoute
              ? _buildBottomAction(order)
              : null,
        ),
      ),
    );
  }

  /// Chỉ hiển thị mini map khi chuyên viên đang di chuyển (`EN_ROUTE`).
  Widget _buildEnRouteMapLayout({
    required CustomerOrderEntity order,
    required LatLng? customerLatLng,
    required OrderTrackingSnapshot? tracking,
    required PaymentDisputeScope paymentScope,
    required Future<void> Function() refreshPayment,
    required bool mutationBlocked,
  }) {
    final providerLatLng = tracking?.hasFreshPosition == true
        ? tracking!.position
        : null;
    final hasUrgentCancellation =
        order.cancellationRequest?.status == 'PENDING_CUSTOMER' ||
        order.cancellationRequest?.status == 'SUPPORT_REVIEW';

    return Stack(
      fit: StackFit.expand,
      children: [
        PaymentDisputeUpdates(
          scope: paymentScope,
          refreshOrder: refreshPayment,
        ),
        Positioned.fill(
          bottom: 290,
          child: customerLatLng == null
              ? const Center(child: Text('Đơn hàng chưa có tọa độ điểm đến.'))
              : CustomerOrderLiveMap(
                  mapController: _mapController,
                  order: order,
                  customerLatLng: customerLatLng,
                  providerLatLng: providerLatLng,
                  routePoints: tracking?.hasFreshPosition == true
                      ? tracking!.routePoints
                      : const [],
                  durationSeconds: tracking?.hasFreshPosition == true
                      ? tracking!.durationSeconds
                      : null,
                  distanceMeters: tracking?.hasFreshPosition == true
                      ? tracking!.distanceMeters
                      : null,
                  showControls: !hasUrgentCancellation,
                ),
        ),
        if (hasUrgentCancellation)
          Positioned(
            top: 12,
            left: 14,
            right: 14,
            child: _UrgentCancellationBanner(order: order),
          ),
        DraggableScrollableSheet(
          initialChildSize: 0.44,
          minChildSize: 0.34,
          maxChildSize: 0.88,
          builder: (context, scrollController) => Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x160B1C30),
                  blurRadius: 18,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                const _SheetHandle(),
                ..._buildProgressSections(
                  order: order,
                  tracking: tracking,
                  mutationBlocked: mutationBlocked,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Giao diện theo dõi tiến trình thoáng, dễ đọc cho các trạng thái không di chuyển.
  Widget _buildCleanProgressLayout({
    required CustomerOrderEntity order,
    required PaymentDisputeScope paymentScope,
    required Future<void> Function() refreshPayment,
    required bool mutationBlocked,
  }) {
    final notifier = ref.read(
      customerOrderDetailNotifierProvider(widget.orderId).notifier,
    );
    return Column(
      children: [
        PaymentDisputeUpdates(
          scope: paymentScope,
          refreshOrder: refreshPayment,
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => notifier.fetchOrder(silent: true),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: _buildProgressSections(
                order: order,
                tracking: null,
                mutationBlocked: mutationBlocked,
              ),
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildProgressSections({
    required CustomerOrderEntity order,
    required OrderTrackingSnapshot? tracking,
    required bool mutationBlocked,
  }) {
    final notifier = ref.read(
      customerOrderDetailNotifierProvider(widget.orderId).notifier,
    );

    return [
      if (order.cancellationRequest?.status == 'PENDING_CUSTOMER' ||
          order.cancellationRequest?.status == 'SUPPORT_REVIEW')
        OrderCancellationDecisionCard(
          request: order.cancellationRequest!,
          onDecide: ({required approve, note}) async {
            final success = await notifier.decideCancellation(
              approve: approve,
              note: note,
            );
            if (success) ref.invalidate(customerOrdersListProvider);
            return success;
          },
        ),
      if (order.cancellationRequest?.status == 'DENIED')
        OrderCancellationStatusBanner(
          status: order.cancellationRequest!.status,
        ),
      OrderRescheduleCard(
        scope: RescheduleScope(widget.orderId, RescheduleRole.customer),
        snapshot: order.rescheduleSnapshot,
        onContact: order.provider?.phone?.isNotEmpty == true
            ? () => CustomerOrderActionCoordinator.makeCall(
                context,
                order.provider!.phone!,
              )
            : null,
        onCancel: order.canCancel
            ? () => CustomerOrderActionCoordinator.openCancellationSheet(
                context: context,
                ref: ref,
                orderId: order.id,
              )
            : null,
        mutationBlocked: mutationBlocked,
        refreshOrder: () async {
          await notifier.fetchOrder(silent: true, queueIfBusy: true);
          if (mounted) ref.invalidate(customerOrdersListProvider);
        },
      ),
      CustomerOrderAddOns(order: order, mutationBlocked: mutationBlocked),
      if (order.isPending && order.providerResponseDeadlineAt != null)
        OrderCountdown(
          deadline: order.providerResponseDeadlineAt!,
          onExpired: () => notifier.fetchOrder(silent: true),
          builder: (_, remaining) => CustomerOrderStatusHeroCard(
            order: order,
            tracking: tracking,
            remainingTime: remaining,
          ),
        )
      else
        CustomerOrderStatusHeroCard(
          order: order,
          tracking: tracking,
          remainingTime: Duration.zero,
        ),
      const SizedBox(height: 12),
      CustomerOrderProviderCard(
        order: order,
        onCall: (phone) =>
            CustomerOrderActionCoordinator.makeCall(context, phone),
      ),
      const SizedBox(height: 12),
      CustomerOrderEvidenceCard(order: order),
      CustomerOrderServiceSummaryCard(order: order),
      if (order.isEnRoute && order.canCancel) ...[
        const SizedBox(height: 12),
        _buildCancelButton(),
      ],
    ];
  }

  Widget? _buildBottomAction(CustomerOrderEntity order) {
    if (order.canCancel) {
      return SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: _buildCancelButton(),
      );
    }
    if (order.isCompleted && order.review == null) {
      return SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: SizedBox(
          height: 50,
          child: ElevatedButton.icon(
            onPressed: () => CustomerOrderActionCoordinator.openReviewSheet(
              context: context,
              ref: ref,
              order: order,
            ),
            icon: const Icon(Icons.star_rounded, size: 20),
            label: const Text(
              'Đánh giá chất lượng phục vụ',
              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ),
      );
    }
    return null;
  }

  Widget _buildCancelButton() {
    return SizedBox(
      height: 48,
      child: OutlinedButton.icon(
        onPressed: () => CustomerOrderActionCoordinator.openCancellationSheet(
          context: context,
          ref: ref,
          orderId: widget.orderId,
        ),
        icon: const Icon(Icons.cancel_outlined, size: 18),
        label: const Text(
          'Hủy đơn đặt lịch',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.error,
          side: BorderSide(color: AppColors.error.withValues(alpha: 0.3)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}

class _OrderStatusSubtitle extends StatelessWidget {
  final CustomerOrderEntity order;

  const _OrderStatusSubtitle({required this.order});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (order.status) {
      'PENDING_PROVIDER' => ('Chờ xác nhận', const Color(0xFFD97706)),
      'ACCEPTED' => ('Đã xác nhận lịch', AppColors.primary),
      'EN_ROUTE' => ('Đang di chuyển', const Color(0xFF2563EB)),
      'ARRIVED' => ('Đã đến địa chỉ', const Color(0xFF7C3AED)),
      'IN_PROGRESS' when order.isWorkPaused => (
        'Đang tạm dừng',
        const Color(0xFFD97706),
      ),
      'IN_PROGRESS' => ('Đang làm việc', AppColors.primary),
      'COMPLETED' => ('Hoàn tất', AppColors.activeEmerald),
      _ => ('Đã kết thúc', AppColors.error),
    };
    return Row(
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 38,
        height: 4,
        margin: const EdgeInsets.only(top: 10, bottom: 14),
        decoration: BoxDecoration(
          color: AppColors.outlineVariant.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}

class _LivePulseBadge extends StatelessWidget {
  final AnimationController pulseController;

  const _LivePulseBadge({required this.pulseController});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: AppColors.activeEmeraldRing.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.activeEmerald.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: pulseController,
            child: Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: AppColors.activeEmerald,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 4),
          const Text(
            'Trực tiếp',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: Color(0xFF047857),
            ),
          ),
        ],
      ),
    );
  }
}

class _UrgentCancellationBanner extends StatelessWidget {
  final CustomerOrderEntity order;

  const _UrgentCancellationBanner({required this.order});

  @override
  Widget build(BuildContext context) {
    final isSupport = order.cancellationRequest?.status == 'SUPPORT_REVIEW';
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(14),
      color: const Color(0xFFFEF2F2),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFCA5A5), width: 1.5),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.warning_amber_rounded,
              color: Color(0xFFDC2626),
              size: 24,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    isSupport
                        ? 'Yêu cầu hủy đang chờ hỗ trợ'
                        : 'Thợ vừa gửi yêu cầu hủy đơn',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Color(0xFF991B1B),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isSupport
                        ? 'Bạn có thể cuộn xuống để bấm Đồng ý hủy ngay lập tức.'
                        : 'Vui lòng cuộn xuống để phê duyệt hoặc từ chối.',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF7F1D1D),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
