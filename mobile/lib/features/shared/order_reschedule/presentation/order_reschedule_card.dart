import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../application/order_reschedule_controller.dart';
import '../domain/order_reschedule.dart';
import 'reschedule_proposal_details.dart';
import 'reschedule_time_picker.dart';

class OrderRescheduleCard extends ConsumerStatefulWidget {
  final RescheduleScope scope;
  final RescheduleOrder snapshot;
  final Future<void> Function() refreshOrder;
  final bool mutationBlocked;
  final VoidCallback? onContact;
  final VoidCallback? onCancel;
  const OrderRescheduleCard({
    super.key,
    required this.scope,
    required this.snapshot,
    required this.refreshOrder,
    this.mutationBlocked = false,
    this.onContact,
    this.onCancel,
  });
  @override
  ConsumerState<OrderRescheduleCard> createState() =>
      _OrderRescheduleCardState();
}

class _OrderRescheduleCardState extends ConsumerState<OrderRescheduleCard>
    with WidgetsBindingObserver {
  bool _foreground = true;
  Timer? _expiry;
  DateTime? _expiresAt;
  final _seenEvents = <String>{};
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

  void _watchExpiry(RescheduleProposal? proposal, DateTime? overdueAt) {
    final future =
        [if (proposal?.status == 'PENDING') proposal?.expiresAt, overdueAt]
            .whereType<DateTime>()
            .where((time) => time.isAfter(DateTime.now()))
            .toList()
          ..sort();
    final deadline = future.isEmpty ? null : future.first;
    if (deadline == _expiresAt) return;
    _expiry?.cancel();
    _expiresAt = deadline;
    if (deadline == null || !deadline.isAfter(DateTime.now())) return;
    _expiry = Timer(deadline.difference(DateTime.now()), () {
      if (mounted) setState(() {});
    });
  }

  Future<void> _refreshParent() async {
    if (!mounted) return;
    try {
      await widget.refreshOrder();
    } catch (_) {
      if (mounted) {
        await AppDialog.error(
          context,
          message: 'Chưa đồng bộ được đơn. Vui lòng tải lại.',
        );
      }
    }
  }

  Future<bool> _confirm(String title, String body) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(body),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      ) ??
      false;

  Future<void> _request(RescheduleOrder order) async {
    final time = await pickRescheduleTime(
      context,
      now: DateTime.now(),
      current: order.startAt,
    );
    if (!mounted || time == null) return;
    final error = validateRescheduleTime(time, DateTime.now(), order.startAt);
    if (error != null) {
      await AppDialog.warning(context, message: error);
      return;
    }
    if (!await _confirm(
          'Gửi đề xuất đổi lịch?',
          '${rescheduleTimeLabel(time)} (giờ Việt Nam). Lịch chỉ đổi sau khi ${widget.scope.role == RescheduleRole.provider ? 'khách' : 'thợ'} chấp nhận.',
        ) ||
        !mounted) {
      return;
    }
    await ref
        .read(orderRescheduleProvider(widget.scope).notifier)
        .request(time);
    await _refreshParent();
  }

  Future<void> _decide(RescheduleProposal proposal, bool approve) async {
    if (!await _confirm(
          approve ? 'Chấp nhận giờ mới?' : 'Từ chối đổi lịch?',
          '${rescheduleTimeLabel(proposal.startAt)} (giờ Việt Nam). ${approve ? 'Hệ thống sẽ kiểm tra lịch trống một lần nữa.' : 'Lịch hiện tại sẽ được giữ nguyên.'}',
        ) ||
        !mounted) {
      return;
    }
    await ref
        .read(orderRescheduleProvider(widget.scope).notifier)
        .decide(proposal, approve);
    await _refreshParent();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(orderRescheduleProvider(widget.scope));
    final remote = state.order;
    final order =
        remote != null && remote.revision.isAfter(widget.snapshot.revision)
        ? remote
        : widget.snapshot;
    final proposal = order.proposal;
    final overdue =
        order.bookingType == 'SCHEDULED' &&
        ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].contains(order.status) &&
        order.overdueAt != null &&
        !order.overdueAt!.isAfter(DateTime.now());
    _watchExpiry(proposal, order.overdueAt);
    if (!order.eligible && proposal == null && !overdue) {
      return const SizedBox.shrink();
    }
    if (_foreground && ModalRoute.of(context)?.isCurrent == true) {
      ref.listen(orderNotificationEventsProvider, (_, value) {
        if (!_foreground || ModalRoute.of(context)?.isCurrent != true) return;
        final event = value.valueOrNull;
        final role = widget.scope.role == RescheduleRole.customer
            ? 'CUSTOMER'
            : 'PROVIDER';
        if (event == null ||
            event.orderId != widget.scope.orderId ||
            event.recipientRole != role ||
            !event.event.startsWith('ORDER_RESCHEDULE_') ||
            !_seenEvents.add(event.id)) {
          return;
        }
        if (_seenEvents.length > 64) _seenEvents.remove(_seenEvents.first);
        unawaited(_refreshParent());
      });
    }
    final safety = ref.watch(
      orderSafetyProvider(
        SafetyScope(
          widget.scope.orderId,
          widget.scope.role == RescheduleRole.customer
              ? SafetyRole.customer
              : SafetyRole.provider,
        ),
      ),
    );
    final disabled =
        widget.mutationBlocked ||
        safety.blocksOrder ||
        state.busy ||
        state.needsRefresh;
    final pending = proposal?.isPending(DateTime.now()) == true;
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  overdue
                      ? Icons.schedule_rounded
                      : Icons.event_repeat_outlined,
                  color: overdue ? Theme.of(context).colorScheme.error : null,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    overdue ? 'Lịch hẹn đã quá giờ' : 'Đổi lịch hẹn',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (overdue)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  order.eligible
                      ? 'Lịch hẹn chưa được bắt đầu đúng giờ. Hai bên cần liên hệ để thống nhất tiếp tục, đổi giờ hoặc hủy lịch hẹn.'
                      : 'Tiến trình đang chậm hơn dự kiến. Hãy liên hệ bên còn lại; trường hợp cần xử lý sẽ được bộ phận hỗ trợ kiểm tra.',
                ),
              ),
            if (order.startAt != null)
              Text('Lịch hiện tại: ${rescheduleTimeLabel(order.startAt!)}'),
            const Text('Giờ Việt Nam (UTC+07:00)'),
            if (proposal != null) ...[
              const SizedBox(height: 8),
              RescheduleProposalDetails(
                proposal: proposal,
                now: DateTime.now(),
              ),
            ],
            if (overdue)
              Wrap(
                spacing: 12,
                children: [
                  if (widget.onContact != null)
                    TextButton.icon(
                      onPressed: disabled ? null : widget.onContact,
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Liên hệ'),
                    ),
                  if (widget.onCancel != null)
                    TextButton.icon(
                      onPressed: disabled ? null : widget.onCancel,
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Hủy lịch hẹn'),
                    ),
                ],
              ),
            SizedBox(
              height: 4,
              child: state.busy ? const LinearProgressIndicator() : null,
            ),
            if (state.error != null)
              Text(
                state.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            if (state.error != null)
              TextButton(
                onPressed: state.busy
                    ? null
                    : () async {
                        await ref
                            .read(
                              orderRescheduleProvider(widget.scope).notifier,
                            )
                            .refresh();
                        await _refreshParent();
                      },
                child: const Text('Tải lại trạng thái'),
              ),
            if (order.eligible && !pending)
              OutlinedButton.icon(
                onPressed: disabled ? null : () => _request(order),
                icon: const Icon(Icons.edit_calendar_outlined),
                label: const Text('Đề xuất giờ mới'),
              ),
            if (order.eligible &&
                pending &&
                proposal!.requestedBy != widget.scope.role)
              Wrap(
                spacing: 12,
                children: [
                  OutlinedButton(
                    onPressed: disabled ? null : () => _decide(proposal, false),
                    child: const Text('Từ chối'),
                  ),
                  FilledButton(
                    onPressed: disabled ? null : () => _decide(proposal, true),
                    child: const Text('Chấp nhận giờ mới'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _expiry?.cancel();
    super.dispose();
  }
}
