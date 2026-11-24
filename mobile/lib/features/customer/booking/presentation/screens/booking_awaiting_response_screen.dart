import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../../data/booking_rematch_service.dart';

import '../providers/booking_candidates_provider.dart';
import '../providers/booking_draft_provider.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

class BookingAwaitingResponseScreen extends ConsumerStatefulWidget {
  final String orderId;

  const BookingAwaitingResponseScreen({super.key, required this.orderId});

  @override
  ConsumerState<BookingAwaitingResponseScreen> createState() =>
      _BookingAwaitingResponseScreenState();
}

class _BookingAwaitingResponseScreenState
    extends ConsumerState<BookingAwaitingResponseScreen> {
  bool _handledAcceptance = false;
  bool _startingRematch = false;

  void _handleAccepted() {
    if (_handledAcceptance) return;
    _handledAcceptance = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(bookingDraftProvider.notifier).reset();
      ref.invalidate(customerOrdersListProvider);
      AppDialog.success(
        context,
        title: 'Đã nhận đơn',
        message: 'Chuyên viên đã nhận đơn của bạn.',
        buttonText: 'Theo dõi đơn',
        barrierDismissible: false,
        onPressed: () {
          if (mounted) context.go('/appointments/${widget.orderId}/tracking');
        },
      );
    });
  }

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
  Widget build(BuildContext context) {
    ref.listen(orderNotificationEventsProvider, (_, next) {
      if (next.valueOrNull?.orderId == widget.orderId) {
        ref
            .read(customerOrderDetailNotifierProvider(widget.orderId).notifier)
            .fetchOrder(silent: true, queueIfBusy: true);
      }
    });
    final detail = ref.watch(
      customerOrderDetailNotifierProvider(widget.orderId),
    );
    ref.listen(customerOrderDetailNotifierProvider(widget.orderId), (_, next) {
      final order = next.order;
      if (order != null &&
          (order.isAccepted ||
              order.isEnRoute ||
              order.isArrived ||
              order.isInProgress ||
              order.isCompleted)) {
        _handleAccepted();
      }
    });

    final order = detail.order;
    if (order != null &&
        (order.isAccepted ||
            order.isEnRoute ||
            order.isArrived ||
            order.isInProgress ||
            order.isCompleted)) {
      _handleAccepted();
    }
    final isAccepted = order != null &&
        (order.isAccepted ||
            order.isEnRoute ||
            order.isArrived ||
            order.isInProgress ||
            order.isCompleted);
    final isDeclined = order?.isRejected == true || order?.isExpired == true;
    final isCancelled = order?.isCancelled == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Yêu cầu đặt lịch'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Đơn của tôi',
          onPressed: () => context.go('/appointments'),
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (detail.isLoading && order == null)
                  const CircularProgressIndicator()
                else if (isAccepted)
                  const Icon(
                    Icons.check_circle_rounded,
                    size: 56,
                    color: Color(0xFF0F766E),
                  )
                else if (isDeclined || isCancelled)
                  Icon(
                    Icons.event_busy_outlined,
                    size: 56,
                    color: Theme.of(context).colorScheme.error,
                  )
                else if (detail.errorMessage != null && order == null)
                  Icon(
                    Icons.wifi_off_outlined,
                    size: 56,
                    color: Theme.of(context).colorScheme.error,
                  )
                else
                  const Icon(
                    Icons.hourglass_top_rounded,
                    size: 56,
                    color: Color(0xFF0F766E),
                  ),
                const SizedBox(height: 20),
                Text(
                  isAccepted
                      ? 'Chuyên viên đã nhận đơn'
                      : isCancelled
                      ? 'Yêu cầu đã được hủy'
                      : isDeclined
                      ? (order!.isRejected
                            ? 'Chuyên viên đã từ chối đơn'
                            : 'Yêu cầu đã hết hạn')
                      : detail.errorMessage != null && order == null
                      ? 'Chưa thể tải trạng thái đơn'
                      : 'Đang chờ chuyên viên phản hồi',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  isAccepted
                      ? 'Đơn hẹn của bạn đã được xác nhận. Bạn có thể theo dõi hành trình ngay bây giờ.'
                      : isCancelled
                      ? 'Bạn có thể xem các đơn khác hoặc bắt đầu đặt lịch mới.'
                      : isDeclined
                      ? (order!.rejectionReason ??
                            'Bạn có thể chọn một chuyên viên khác cho dịch vụ này.')
                      : detail.errorMessage ?? 'Yêu cầu đã được gửi. Đơn chỉ được xác nhận khi chuyên viên đồng ý nhận.',
                  textAlign: TextAlign.center,
                ),
                if (order?.isPending == true &&
                    order?.providerResponseDeadlineAt != null) ...[
                  const SizedBox(height: 16),
                  OrderCountdown(
                    deadline: order!.providerResponseDeadlineAt!,
                    onExpired: () => ref
                        .read(
                          customerOrderDetailNotifierProvider(widget.orderId)
                              .notifier,
                        )
                        .fetchOrder(silent: true),
                    builder: (_, remaining) => Text(
                      remaining == Duration.zero
                          ? 'Đang cập nhật kết quả phản hồi...'
                          : 'Thời gian phản hồi còn ${remaining.inMinutes}:${(remaining.inSeconds % 60).toString().padLeft(2, '0')}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                if (isAccepted)
                  FilledButton.icon(
                    onPressed: () => context.go(
                      '/appointments/${widget.orderId}/tracking',
                    ),
                    icon: const Icon(Icons.navigation_outlined),
                    label: const Text('Theo dõi đơn'),
                  )
                else if (isDeclined)
                  FilledButton.icon(
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
                  )
                else if (isCancelled)
                  FilledButton.icon(
                    onPressed: () => context.go('/appointments'),
                    icon: const Icon(Icons.list_alt_outlined),
                    label: const Text('Xem các đơn của tôi'),
                  )
                else if (detail.errorMessage != null && order == null)
                  FilledButton.icon(
                    onPressed: () => ref
                        .read(
                          customerOrderDetailNotifierProvider(widget.orderId)
                              .notifier,
                        )
                        .fetchOrder(),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Thử lại'),
                  )
                else
                  TextButton(
                    onPressed: () =>
                        context.go('/appointments/${widget.orderId}'),
                    child: const Text('Xem chi tiết yêu cầu'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
