import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';
import 'package:mobile/features/shared/order_reschedule/presentation/order_reschedule_card.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_history_button.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_button.dart';
import 'package:mobile/features/shared/order_safety/presentation/order_safety_screen.dart';
import 'package:flutter/material.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_screen.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_summary.dart';
import 'package:mobile/features/shared/payment_dispute/presentation/payment_dispute_updates.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../controllers/customer_order_action_coordinator.dart';
import '../providers/customer_orders_providers.dart';
import '../../domain/entities/customer_order_entity.dart';
import '../widgets/cancellation/order_cancellation_decision_card.dart';
import '../widgets/cancellation/order_cancellation_status_banner.dart';
import '../widgets/detail/order_status_badge.dart';
import '../widgets/detail/customer_order_add_ons.dart';
import '../widgets/detail/customer_order_provider_card.dart';
import '../widgets/detail/customer_order_info_cards.dart';
import '../widgets/detail/order_status_timeline.dart';

import 'package:mobile/features/customer/booking/data/booking_rematch_service.dart';
import 'package:mobile/features/customer/booking/presentation/providers/booking_candidates_provider.dart';
import 'package:mobile/features/customer/booking/presentation/providers/booking_draft_provider.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';
import 'package:mobile/core/routing/app_route_observer.dart';

class CustomerOrderDetailScreen extends ConsumerStatefulWidget {
  final String orderId;

  const CustomerOrderDetailScreen({super.key, required this.orderId});

  @override
  ConsumerState<CustomerOrderDetailScreen> createState() =>
      _CustomerOrderDetailScreenState();
}

class _CustomerOrderDetailScreenState
    extends ConsumerState<CustomerOrderDetailScreen>
    with WidgetsBindingObserver, RouteAware, RouteVisibility {
  bool _startingRematch = false;

  Future<void> _chooseAnotherProvider() async {
    if (_startingRematch) return;
    setState(() => _startingRematch = true);
    try {
      final source = await ref
          .read(bookingRematchServiceProvider)
          .load(widget.orderId);
      if (!mounted) return;
      ref
          .read(bookingDraftProvider.notifier)
          .initializeRematch(
            sourceOrderId: widget.orderId,
            service: source.service,
            orderDraft: source.orderDraft,
          );
      ref.invalidate(bookingCandidatesProvider);
      context.push('/booking/providers');
    } catch (error) {
      if (!mounted) return;
      await ref
          .read(customerOrderDetailNotifierProvider(widget.orderId).notifier)
          .fetchOrder(silent: true);
      if (mounted) {
        AppDialog.error(
          context,
          message: '$error'.replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _startingRematch = false);
    }
  }

  @override
  void onVisibilityChanged(bool visible) {
    final notifier = ref.read(
      customerOrderDetailNotifierProvider(widget.orderId).notifier,
    );
    if (visible) {
      notifier.resumePolling();
    } else {
      notifier.pausePolling();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(
      customerOrderDetailNotifierProvider(widget.orderId),
    );
    ref.listen(customerOrderDetailNotifierProvider(widget.orderId), (
      previous,
      next,
    ) {
      if (previous?.order?.isPending != true ||
          next.order == null ||
          next.order!.isPending) {
        return;
      }
      ref.invalidate(customerOrdersListProvider);
      if (next.order!.isAccepted) {
        AppDialog.success(
          context,
          title: 'Đã nhận đơn',
          message: 'Chuyên viên đã nhận đơn của bạn.',
          buttonText: 'Theo dõi đơn',
          onPressed: () {
            if (mounted) {
              context.go('/appointments/${widget.orderId}/tracking');
            }
          },
        );
      } else if (next.order!.isRejected || next.order!.isExpired) {
        AppDialog.warning(
          context,
          title: 'Đơn chưa được nhận',
          message: 'Chuyên viên không nhận đơn. Hãy chọn người khác.',
        );
      }
    });

    if (state.isLoading && state.order == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: AppBar(title: const Text('Chi tiết đơn hàng')),
        body: const Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
      );
    }

    if (state.errorMessage != null && state.order == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: AppBar(title: const Text('Chi tiết đơn hàng')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: Color(0xFFDC2626),
                ),
                const SizedBox(height: 12),
                Text(
                  state.errorMessage!,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
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
      return PaymentDisputeScreen(
        scope: paymentScope,
        snapshot: order.paymentDispute!,
        refreshOrder: refreshPayment,
        error: state.errorMessage,
      );
    }
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: Text(
          'Đơn #${order.id.length > 8 ? order.id.substring(0, 8).toUpperCase() : order.id}',
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0B1C30),
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 20,
            color: Color(0xFF0B1C30),
          ),
          onPressed: () {
            if (GoRouter.of(context).canPop()) {
              context.pop();
            } else {
              context.go('/appointments');
            }
          },
        ),
        actions: [
          if (order.statusHistory.any(
            (entry) => entry.toStatus == 'SAFETY_HOLD',
          ))
            OrderSafetyHistoryButton(
              scope: safetyScope,
              refreshOrder: () => ref
                  .read(
                    customerOrderDetailNotifierProvider(widget.orderId)
                        .notifier,
                  )
                  .fetchOrder(silent: true),
            ),
          if (canRaiseSafety(order.status))
            OrderSafetyButton(scope: safetyScope),
          if (order.isActive)
            IconButton(
              icon: const Icon(Icons.near_me_rounded, color: Color(0xFF0F766E)),
              tooltip: 'Theo dõi trực tiếp',
              onPressed: () =>
                  context.push('/appointments/${order.id}/tracking'),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0F766E)),
            onPressed: () => ref
                .read(
                  customerOrderDetailNotifierProvider(widget.orderId).notifier,
                )
                .fetchOrder(),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () => ref
            .read(customerOrderDetailNotifierProvider(widget.orderId).notifier)
            .fetchOrder(),
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          children: [
            PaymentDisputeUpdates(
              scope: paymentScope,
              refreshOrder: refreshPayment,
            ),
            if (order.paymentDispute?.hasHistory == true)
              PaymentDisputeSummary(
                order: order.paymentDispute!,
                role: PaymentDisputeRole.customer,
              ),
            OrderRescheduleCard(
              scope: RescheduleScope(widget.orderId, RescheduleRole.customer),
              snapshot: order.rescheduleSnapshot,
              mutationBlocked: state.isCancelling,
              refreshOrder: () async {
                await ref
                    .read(
                      customerOrderDetailNotifierProvider(widget.orderId)
                          .notifier,
                    )
                    .fetchOrder(silent: true, queueIfBusy: true);
                if (mounted) ref.invalidate(customerOrdersListProvider);
              },
            ),
            CustomerOrderAddOns(
              order: order,
              mutationBlocked: state.isCancelling,
            ),
            // Banner theo dõi trực tiếp trên bản đồ khi đơn đang active
            if (order.isActive) _buildLiveTrackingBanner(order),

            // Banner đếm ngược phản hồi khi PENDING_PROVIDER
            if (order.isPending && order.providerResponseDeadlineAt != null)
              _buildPendingCountdownBanner(order),

            // Card xử lý khi thợ yêu cầu hủy (ở cả PENDING_CUSTOMER hoặc SUPPORT_REVIEW)
            if (order.cancellationRequest?.status == 'PENDING_CUSTOMER' ||
                order.cancellationRequest?.status == 'SUPPORT_REVIEW')
              OrderCancellationDecisionCard(
                request: order.cancellationRequest!,
                onDecide: ({required approve, note}) async {
                  final success = await ref
                      .read(
                        customerOrderDetailNotifierProvider(widget.orderId)
                            .notifier,
                      )
                      .decideCancellation(approve: approve, note: note);
                  if (success) ref.invalidate(customerOrdersListProvider);
                  return success;
                },
              ),
            if (order.cancellationRequest?.status == 'DENIED')
              OrderCancellationStatusBanner(
                status: order.cancellationRequest!.status,
              ),

            // Card Trạng thái hiện tại
            _buildStatusHeaderCard(order),
            const SizedBox(height: 12),

            // Card Chuyên viên phục vụ
            CustomerOrderProviderCard(
              order: order,
              onCall: (phone) =>
                  CustomerOrderActionCoordinator.makeCall(context, phone),
              showRating: false,
            ),
            const SizedBox(height: 12),

            // Card Dịch vụ & Thời gian
            CustomerOrderServiceTimeCard(order: order),
            const SizedBox(height: 12),

            // Card Địa chỉ phục vụ
            CustomerOrderAddressCard(order: order),
            const SizedBox(height: 12),

            // Card Chi tiết thanh toán
            CustomerOrderPricingCard(
              order: order,
              currencyFormatter: currencyFormatter,
            ),
            const SizedBox(height: 12),

            // Đánh giá đã hoàn tất (nếu có)
            if (order.review != null) ...[
              CustomerOrderReviewSummaryCard(review: order.review!),
              const SizedBox(height: 12),
            ],

            // Timeline trạng thái
            OrderStatusTimeline(
              history: order.statusHistory,
              currentStatus: order.status,
            ),
            const SizedBox(height: 80),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomBar(order),
    );
  }

  Widget _buildLiveTrackingBanner(CustomerOrderEntity order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F766E), Color(0xFF115E59)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x330F766E),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.near_me_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tiến trình đang diễn ra',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Xem vị trí thợ & tiến trình trực tiếp',
                  style: TextStyle(fontSize: 12, color: Color(0xFFCCFBF1)),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () {
              context.push('/appointments/${order.id}/tracking');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF0F766E),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'Theo dõi',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPendingCountdownBanner(CustomerOrderEntity order) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.timer_outlined,
              color: Color(0xFFD97706),
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Đang chờ chuyên viên xác nhận',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF92400E),
                  ),
                ),
                const SizedBox(height: 2),
                OrderCountdown(
                  deadline: order.providerResponseDeadlineAt!,
                  onExpired: () => ref
                      .read(
                        customerOrderDetailNotifierProvider(widget.orderId)
                            .notifier,
                      )
                      .fetchOrder(silent: true),
                  builder: (_, remaining) => Text(
                    'Hết hạn sau: ${remaining.inMinutes.toString().padLeft(2, '0')}:${(remaining.inSeconds % 60).toString().padLeft(2, '0')} (Tự động cập nhật)',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFB45309),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusHeaderCard(CustomerOrderEntity order) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Trạng thái hiện tại',
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w500,
            ),
          ),
          OrderStatusBadge(
            status: order.status,
            cancellationStatus: order.cancellationRequest?.status,
          ),
        ],
      ),
    );
  }

  Widget? _buildBottomBar(CustomerOrderEntity order) {
    if (order.isRejected || order.isExpired) {
      return SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton.icon(
          onPressed: _startingRematch ? null : _chooseAnotherProvider,
          icon: _startingRematch
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.person_search_outlined),
          label: Text(
            _startingRematch
                ? 'Đang tìm chuyên viên...'
                : 'Chọn chuyên viên khác',
          ),
        ),
      );
    }
    // Thanh hành động khi thợ yêu cầu hủy đơn
    if (order.cancellationRequest?.status == 'PENDING_CUSTOMER' ||
        order.cancellationRequest?.status == 'SUPPORT_REVIEW') {
      final isSupportReview =
          order.cancellationRequest?.status == 'SUPPORT_REVIEW';
      return Container(
        padding: EdgeInsets.fromLTRB(
          16,
          10,
          16,
          MediaQuery.of(context).padding.bottom + 10,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: Row(
          children: [
            if (!isSupportReview) ...[
              Expanded(
                child: SizedBox(
                  height: 46,
                  child: OutlinedButton(
                    onPressed: () async {
                      final success = await ref
                          .read(
                            customerOrderDetailNotifierProvider(widget.orderId)
                                .notifier,
                          )
                          .decideCancellation(approve: false);
                      if (success) ref.invalidate(customerOrdersListProvider);
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626),
                      side: const BorderSide(color: Color(0xFFDC2626)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Từ chối hủy',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              flex: isSupportReview ? 1 : 2,
              child: SizedBox(
                height: 46,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final success = await ref
                        .read(
                          customerOrderDetailNotifierProvider(widget.orderId)
                              .notifier,
                        )
                        .decideCancellation(approve: true);
                    if (success) ref.invalidate(customerOrdersListProvider);
                  },
                  icon: const Icon(
                    Icons.check_circle_outline_rounded,
                    size: 18,
                  ),
                  label: const Text(
                    'Đồng ý hủy đơn ngay',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (order.canCancel) {
      return Container(
        padding: EdgeInsets.fromLTRB(
          16,
          10,
          16,
          MediaQuery.of(context).padding.bottom + 10,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: SizedBox(
          width: double.infinity,
          height: 46,
          child: OutlinedButton.icon(
            onPressed: () =>
                CustomerOrderActionCoordinator.openCancellationSheet(
                  context: context,
                  ref: ref,
                  orderId: widget.orderId,
                ),
            icon: const Icon(Icons.cancel_outlined, size: 18),
            label: const Text(
              'Hủy đơn đặt lịch',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFDC2626),
              side: const BorderSide(color: Color(0xFFFECACA)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      );
    }

    if (order.isCompleted && order.review == null) {
      return Container(
        padding: EdgeInsets.fromLTRB(
          16,
          10,
          16,
          MediaQuery.of(context).padding.bottom + 10,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: SizedBox(
          width: double.infinity,
          height: 46,
          child: ElevatedButton.icon(
            onPressed: () => CustomerOrderActionCoordinator.openReviewSheet(
              context: context,
              ref: ref,
              order: order,
            ),
            icon: const Icon(Icons.star_rounded, size: 18),
            label: const Text(
              'Đánh giá chất lượng dịch vụ',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      );
    }

    return null;
  }
}
