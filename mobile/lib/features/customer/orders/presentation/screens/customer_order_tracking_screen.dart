import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/order_reschedule_card.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_button.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_screen.dart';
import 'package:flutter/material.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_screen.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_updates.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../controllers/customer_order_action_coordinator.dart';
import '../providers/customer_orders_providers.dart';
import '../../domain/entities/customer_order_entity.dart';
import '../widgets/cancellation/order_cancellation_decision_card.dart';
import '../widgets/cancellation/order_cancellation_status_banner.dart';
import '../widgets/detail/customer_order_provider_card.dart';
import '../widgets/detail/customer_order_add_ons.dart';
import '../widgets/tracking/customer_order_live_map.dart';
import '../widgets/tracking/customer_order_tracking_cards.dart';

import 'package:mobile/features/shared/tracking/presentation/order_tracking_provider.dart';

import 'package:mobile/core/widgets/order_countdown.dart';
import 'package:mobile/core/routing/app_route_observer.dart';

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
    ref.read(orderTrackingActiveProvider(widget.orderId).notifier).state =
        active;
    final notifier = ref.read(
      customerOrderDetailNotifierProvider(widget.orderId).notifier,
    );
    if (active) {
      notifier.resumePolling();
    } else {
      notifier.pausePolling();
      _pulseController.stop();
    }
    if (active != _trackingActive) {
      setState(() => _trackingActive = active);
    }
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

    if (state.isLoading && state.order == null) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          title: const Text(
            'Theo dõi đơn hàng',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.onBackground,
            ),
          ),
          backgroundColor: AppColors.surfaceContainerLowest,
          elevation: 0.5,
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (state.errorMessage != null && state.order == null) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          title: const Text(
            'Theo dõi đơn hàng',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.onBackground,
            ),
          ),
          backgroundColor: AppColors.surfaceContainerLowest,
          elevation: 0.5,
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
                  onPressed: () => ref
                      .read(
                        customerOrderDetailNotifierProvider(widget.orderId)
                            .notifier,
                      )
                      .fetchOrder(),
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
      );
    }

    final order = state.order!;
    final safetyScope = SafetyScope(widget.orderId, SafetyRole.customer);
    final safety = ref.watch(orderSafetyProvider(safetyScope));
    if (order.isSafetyHold || safety.blocksOrder) {
      _pulseController.stop();
      return OrderSafetyScreen(
        scope: safetyScope,
        refreshOrder: () => ref
            .read(customerOrderDetailNotifierProvider(widget.orderId).notifier)
            .fetchOrder(silent: true, queueIfBusy: true),
      );
    }
    final paymentScope = PaymentDisputeScope(
      widget.orderId,
      PaymentDisputeRole.customer,
    );
    Future<void> refreshPayment() async {
      await ref
          .read(customerOrderDetailNotifierProvider(widget.orderId).notifier)
          .fetchOrder(silent: true, queueIfBusy: true);
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
    final providerLatLng = tracking?.hasFreshPosition == true
        ? tracking!.position
        : null;
    if (_trackingActive &&
        order.isEnRoute &&
        tracking?.hasFreshPosition == true) {
      if (!_pulseController.isAnimating) _pulseController.repeat(reverse: true);
    } else {
      _pulseController.stop();
    }
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          context.go('/appointments');
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          backgroundColor: AppColors.surfaceContainerLowest,
          elevation: 0.5,
          leading: IconButton(
            icon: const Icon(
              Icons.arrow_back_rounded,
              color: AppColors.onBackground,
            ),
            onPressed: () =>
                context.canPop() ? context.pop() : context.go('/appointments'),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text(
                    'Theo dõi tiến trình',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onBackground,
                    ),
                  ),
                  if (order.isEnRoute &&
                      tracking?.hasFreshPosition == true) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 2.5,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.activeEmeraldRing.withValues(
                          alpha: 0.5,
                        ),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: AppColors.activeEmerald.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FadeTransition(
                            opacity: _pulseController,
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
                    ),
                  ],
                ],
              ),
              Text(
                'Mã đơn #${order.id.length > 8 ? order.id.substring(0, 8).toUpperCase() : order.id}',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
          actions: [
            if (canRaiseSafety(order.status))
              OrderSafetyButton(scope: safetyScope),
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: AppColors.primary),
              onPressed: () => ref
                  .read(
                    customerOrderDetailNotifierProvider(widget.orderId)
                        .notifier,
                  )
                  .fetchOrder(),
            ),
            IconButton(
              icon: const Icon(
                Icons.receipt_long_outlined,
                color: AppColors.primary,
              ),
              tooltip: 'Xem hóa đơn',
              onPressed: () => context.push('/appointments/${order.id}'),
            ),
          ],
        ),
        body: Stack(
          fit: StackFit.expand,
          children: [
            PaymentDisputeUpdates(
              scope: paymentScope,
              refreshOrder: refreshPayment,
            ),
            // 1. Bản đồ vị trí trực quan
            Positioned.fill(
              bottom: 340,
              child: customerLatLng == null
                  ? const Center(
                      child: Text('Đơn hàng chưa có tọa độ điểm đến.'),
                    )
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
                      showControls:
                          order.cancellationRequest?.status !=
                              'PENDING_CUSTOMER' &&
                          order.cancellationRequest?.status != 'SUPPORT_REVIEW',
                    ),
            ),

            // Banner cảnh báo khẩn cấp khi thợ yêu cầu hủy
            if (order.cancellationRequest?.status == 'PENDING_CUSTOMER' ||
                order.cancellationRequest?.status == 'SUPPORT_REVIEW')
              Positioned(
                top: 12,
                left: 14,
                right: 14,
                child: Material(
                  elevation: 4,
                  borderRadius: BorderRadius.circular(14),
                  color: const Color(0xFFFEF2F2),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(0xFFFCA5A5),
                        width: 1.5,
                      ),
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
                                order.cancellationRequest?.status ==
                                        'SUPPORT_REVIEW'
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
                                order.cancellationRequest?.status ==
                                        'SUPPORT_REVIEW'
                                    ? 'Bạn có thể cuộn panel bên dưới để bấm Đồng ý hủy ngay lập tức.'
                                    : 'Vui lòng cuộn panel bên dưới để phê duyệt hoặc từ chối.',
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
                ),
              ),

            // Panel thông tin tiến trình trượt lên ở phía dưới
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 360,
              child: Container(
                decoration: const BoxDecoration(
                  color: AppColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x140B1C30),
                      blurRadius: 18,
                      offset: Offset(0, -4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Thanh kéo handle
                    Container(
                      width: 38,
                      height: 4,
                      margin: const EdgeInsets.only(top: 10, bottom: 8),
                      decoration: BoxDecoration(
                        color: AppColors.outlineVariant.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),

                    // Nội dung cuộn
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        children: [
                          if (order.cancellationRequest?.status ==
                                  'PENDING_CUSTOMER' ||
                              order.cancellationRequest?.status ==
                                  'SUPPORT_REVIEW')
                            OrderCancellationDecisionCard(
                              request: order.cancellationRequest!,
                              onDecide: ({required approve, note}) async {
                                final success = await ref
                                    .read(
                                      customerOrderDetailNotifierProvider(
                                        widget.orderId,
                                      ).notifier,
                                    )
                                    .decideCancellation(
                                      approve: approve,
                                      note: note,
                                    );
                                if (success) {
                                  ref.invalidate(customerOrdersListProvider);
                                }
                                return success;
                              },
                            ),
                          if (order.cancellationRequest?.status == 'DENIED')
                            OrderCancellationStatusBanner(
                              status: order.cancellationRequest!.status,
                            ),
                          OrderRescheduleCard(
                            scope: RescheduleScope(
                              widget.orderId,
                              RescheduleRole.customer,
                            ),
                            snapshot: order.rescheduleSnapshot,
                            mutationBlocked: state.isCancelling,
                            refreshOrder: () async {
                              await ref
                                  .read(
                                    customerOrderDetailNotifierProvider(
                                      widget.orderId,
                                    ).notifier,
                                  )
                                  .fetchOrder(silent: true, queueIfBusy: true);
                              if (mounted) {
                                ref.invalidate(customerOrdersListProvider);
                              }
                            },
                          ),
                          CustomerOrderAddOns(
                            order: order,
                            mutationBlocked: state.isCancelling,
                          ),
                          // Card Trạng thái thời gian thực
                          if (order.isPending &&
                              order.providerResponseDeadlineAt != null)
                            OrderCountdown(
                              deadline: order.providerResponseDeadlineAt!,
                              onExpired: () => ref
                                  .read(
                                    customerOrderDetailNotifierProvider(
                                      widget.orderId,
                                    ).notifier,
                                  )
                                  .fetchOrder(silent: true),
                              builder: (_, remaining) =>
                                  CustomerOrderStatusHeroCard(
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
                          const SizedBox(height: 14),

                          // Stepper tiến trình
                          CustomerOrderTrackingStepper(order: order),
                          const SizedBox(height: 14),

                          // Card Chuyên viên phục vụ
                          CustomerOrderProviderCard(
                            order: order,
                            onCall: (phone) =>
                                CustomerOrderActionCoordinator.makeCall(
                                  context,
                                  phone,
                                ),
                          ),
                          const SizedBox(height: 14),

                          // Tóm tắt dịch vụ & Tổng tiền
                          CustomerOrderServiceSummaryCard(order: order),
                          const SizedBox(height: 14),

                          // Hành động bổ trợ (Hủy đơn hoặc Đánh giá)
                          if (order.canCancel)
                            OutlinedButton.icon(
                              onPressed: () =>
                                  CustomerOrderActionCoordinator.openCancellationSheet(
                                    context: context,
                                    ref: ref,
                                    orderId: widget.orderId,
                                  ),
                              icon: const Icon(Icons.cancel_outlined, size: 18),
                              label: const Text(
                                'Hủy đơn đặt lịch này',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.error,
                                side: BorderSide(
                                  color: AppColors.error.withValues(alpha: 0.3),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 13,
                                ),
                              ),
                            )
                          else if (order.isCompleted && order.review == null)
                            ElevatedButton.icon(
                              onPressed: () =>
                                  CustomerOrderActionCoordinator.openReviewSheet(
                                    context: context,
                                    ref: ref,
                                    order: order,
                                  ),
                              icon: const Icon(Icons.star_rounded, size: 18),
                              label: const Text(
                                'Đánh giá chất lượng phục vụ',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: AppColors.onPrimary,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 13,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
