import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../../../data/booking_rematch_service.dart';
import '../../../domain/entities/booking_submission_entity.dart';
import '../../providers/booking_candidates_provider.dart';
import '../../providers/booking_draft_provider.dart';

class BookingAwaitingDialog extends ConsumerStatefulWidget {
  final BookingSubmissionEntity submission;
  final String providerName;

  const BookingAwaitingDialog({
    super.key,
    required this.submission,
    required this.providerName,
  });

  static Future<void> show(
    BuildContext context, {
    required BookingSubmissionEntity submission,
    required String providerName,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (_) => BookingAwaitingDialog(
        submission: submission,
        providerName: providerName,
      ),
    );
  }

  @override
  ConsumerState<BookingAwaitingDialog> createState() =>
      _BookingAwaitingDialogState();
}

class _BookingAwaitingDialogState extends ConsumerState<BookingAwaitingDialog> {
  bool _handledAcceptance = false;
  bool _startingRematch = false;
  String? _liveEventStatus;

  void _onAcceptedSynced() {
    if (_handledAcceptance) return;
    _handledAcceptance = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(bookingDraftProvider.notifier).reset();
      ref.invalidate(customerOrdersListProvider);
    });
  }

  Future<void> _chooseAnotherProvider() async {
    if (_startingRematch) return;
    setState(() => _startingRematch = true);
    final orderId = widget.submission.id;
    try {
      final source = await ref.read(bookingRematchServiceProvider).load(orderId);
      if (!mounted) return;
      ref
          .read(bookingDraftProvider.notifier)
          .initializeRematch(
            sourceOrderId: orderId,
            service: source.service,
            orderDraft: source.orderDraft,
          );
      ref.invalidate(bookingCandidatesProvider);
      final router = GoRouter.of(context);
      Navigator.of(context).pop();
      router.push('/booking/providers');
    } catch (error) {
      if (!mounted) return;
      await ref
          .read(customerOrderDetailNotifierProvider(orderId).notifier)
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

  void _navigateAndClose(String route, {bool resetDraft = true}) {
    if (resetDraft) {
      ref.read(bookingDraftProvider.notifier).reset();
      ref.invalidate(customerOrdersListProvider);
    }
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.go(route);
  }

  @override
  Widget build(BuildContext context) {
    final orderId = widget.submission.id;
    ref.listen(orderNotificationEventsProvider, (_, next) {
      final notice = next.valueOrNull;
      if (notice?.orderId == orderId) {
        final nextStatus = switch (notice!.event) {
          'ORDER_ACCEPTED' => 'ACCEPTED',
          'ORDER_REJECTED' => 'REJECTED',
          'ORDER_EXPIRED' => 'EXPIRED',
          _ => null,
        };
        if (nextStatus != null && mounted && _liveEventStatus != nextStatus) {
          setState(() => _liveEventStatus = nextStatus);
        }
        ref
            .read(customerOrderDetailNotifierProvider(orderId).notifier)
            .fetchOrder(silent: true, queueIfBusy: true);
      }
    });

    final detail = ref.watch(customerOrderDetailNotifierProvider(orderId));
    final order = detail.order;

    final isAccepted =
        (order != null &&
            (order.isAccepted ||
                order.isEnRoute ||
                order.isArrived ||
                order.isInProgress ||
                order.isCompleted)) ||
        _liveEventStatus == 'ACCEPTED';
    if (isAccepted) {
      _onAcceptedSynced();
    }

    final isRejectedEvent =
        order?.isRejected == true || _liveEventStatus == 'REJECTED';
    final isExpiredEvent =
        order?.isExpired == true || _liveEventStatus == 'EXPIRED';
    final isDeclined = isRejectedEvent || isExpiredEvent;
    final isCancelled = order?.isCancelled == true;
    final isStillPending =
        !isAccepted &&
        !isDeclined &&
        !isCancelled &&
        (order == null
            ? widget.submission.status == 'PENDING_PROVIDER'
            : order.isPending);
    final deadline =
        order?.providerResponseDeadlineAt ?? widget.submission.providerResponseDeadlineAt;

    return PopScope(
      canPop: false,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 24),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isAccepted)
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
              else
                const SizedBox(
                  width: 52,
                  height: 52,
                  child: CircularProgressIndicator(
                    strokeWidth: 3.5,
                    color: Color(0xFF0F766E),
                  ),
                ),
              const SizedBox(height: 18),
              Text(
                isAccepted
                    ? 'Chuyên viên đã nhận đơn'
                    : isCancelled
                    ? 'Yêu cầu đã được hủy'
                    : isDeclined
                    ? (isRejectedEvent
                          ? 'Chuyên viên đã từ chối đơn'
                          : 'Đã hết thời gian phản hồi')
                    : 'Đang chờ ${widget.providerName} xác nhận',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isAccepted
                    ? 'Đơn hẹn của bạn đã được xác nhận. Bạn có thể theo dõi hành trình ngay bây giờ.'
                    : isCancelled
                    ? 'Bạn có thể xem các đơn khác hoặc đặt lịch mới.'
                    : isDeclined
                    ? (order?.rejectionReason ??
                          'Bạn có thể chọn một chuyên viên khác cho dịch vụ này.')
                    : 'Yêu cầu đã được gửi ngay tới chuyên viên.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13.5,
                  color: Color(0xFF475569),
                  height: 1.4,
                ),
              ),
              if (isStillPending && deadline != null) ...[
                const SizedBox(height: 16),
                OrderCountdown(
                  deadline: deadline,
                  onExpired: () => ref
                      .read(customerOrderDetailNotifierProvider(orderId).notifier)
                      .fetchOrder(silent: true, queueIfBusy: true),
                  builder: (_, remaining) => Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(
                        color: const Color(0xFF0F766E).withValues(alpha: 0.25),
                      ),
                    ),
                    child: Text(
                      remaining == Duration.zero
                          ? 'Đang kiểm tra kết quả phản hồi...'
                          : 'Thời gian phản hồi còn ${remaining.inMinutes}:${(remaining.inSeconds % 60).toString().padLeft(2, '0')}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 22),
              if (isAccepted)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () =>
                        _navigateAndClose('/appointments/$orderId/tracking'),
                    icon: const Icon(Icons.navigation_outlined),
                    label: const Text('Theo dõi đơn'),
                  ),
                )
              else if (isDeclined) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: _startingRematch ? null : _chooseAnotherProvider,
                    icon: _startingRematch
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.person_search_outlined),
                    label: Text(
                      _startingRematch
                          ? 'Đang tìm chuyên viên...'
                          : 'Chọn chuyên viên khác',
                    ),
                  ),
                ),
              ] else if (isCancelled)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () => _navigateAndClose('/appointments'),
                    icon: const Icon(Icons.list_alt_outlined),
                    label: const Text('Xem các đơn của tôi'),
                  ),
                )
              else
                TextButton(
                  onPressed: () => _navigateAndClose('/appointments/$orderId'),
                  child: const Text('Xem chi tiết yêu cầu'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

