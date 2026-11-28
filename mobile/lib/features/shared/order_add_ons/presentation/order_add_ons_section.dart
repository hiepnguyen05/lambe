import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import '../application/order_add_ons_controller.dart';
import '../data/order_add_ons_repository.dart';
import '../domain/add_on_order.dart';
import '../domain/order_add_on.dart';
import 'add_on_format.dart';
import 'add_on_line_items.dart';
import 'add_on_picker.dart';
import 'add_on_proposal_tile.dart';

class OrderAddOnsSection extends ConsumerStatefulWidget {
  final AddOnScope scope;
  final AddOnOrder snapshot;
  final Future<void> Function() refreshOrder;
  final void Function(Map<String, dynamic>)? onServerOrder;
  final bool mutationBlocked;
  const OrderAddOnsSection({
    super.key,
    required this.scope,
    required this.snapshot,
    required this.refreshOrder,
    this.onServerOrder,
    this.mutationBlocked = false,
  });
  @override
  ConsumerState<OrderAddOnsSection> createState() => _OrderAddOnsSectionState();
}

class _OrderAddOnsSectionState extends ConsumerState<OrderAddOnsSection>
    with WidgetsBindingObserver {
  Timer? _expiry;
  DateTime? _deadline;
  bool _foreground = true, _syncing = false;
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

  void _watchExpiry(AddOnOrder order) {
    DateTime? deadline;
    for (final item in order.items) {
      if (item.pending(DateTime.now()) &&
          (deadline == null || item.expiresAt.isBefore(deadline))) {
        deadline = item.expiresAt;
      }
    }
    if (_deadline == deadline) return;
    _expiry?.cancel();
    _deadline = deadline;
    if (deadline != null) {
      _expiry = Timer(deadline.difference(DateTime.now()), () {
        if (mounted) setState(() {});
      });
    }
  }

  Future<void> _refresh() async {
    if (!mounted || _syncing) return;
    setState(() => _syncing = true);
    try {
      await Future.wait([
        ref.read(orderAddOnsProvider(widget.scope).notifier).refresh(),
        widget.refreshOrder(),
      ]);
    } catch (_) {
      if (mounted) {
        await AppDialog.error(
          context,
          message: 'Chưa tải được đơn mới. Vui lòng thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<bool> _confirm(String title, String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(text),
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

  Future<void> _perform(Future<AddOnOutcome> Function() action) async {
    final result = await action();
    if (!mounted) return;
    if (result.orderJson != null) widget.onServerOrder?.call(result.orderJson!);
    await _refresh();
  }

  Future<void> _propose(AddOnOrder order) async {
    final draft = await showModalBottomSheet<AddOnDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) =>
          AddOnPicker(scope: widget.scope, currency: order.currencyCode),
    );
    if (!mounted || draft == null) return;
    final option = draft.option;
    if (!await _confirm(
          'Gửi đề nghị thêm dịch vụ?',
          '${option.serviceName}\n'
              '${addOnMoney(option.priceAmount, order.currencyCode)} · ${option.durationMinutes} phút\n'
              'Tổng đề xuất: ${addOnMoney(option.proposedTotalAmount, order.currencyCode)}\nKhách phải đồng ý trước khi thực hiện.',
        ) ||
        !mounted) {
      return;
    }
    await _perform(
      () => ref
          .read(orderAddOnsProvider(widget.scope).notifier)
          .propose(option, draft.note),
    );
  }

  Future<void> _decide(OrderAddOn item, bool approve, String currency) async {
    if (!await _confirm(
          approve ? 'Đồng ý thêm dịch vụ?' : 'Từ chối đề nghị?',
          '${item.serviceName}\n'
          'Thêm ${addOnMoney(item.priceAmount, currency)} · ${item.durationMinutes} phút\n'
          'Tổng đề xuất: ${addOnMoney(item.proposedTotalAmount, currency)}\n'
          'Kết thúc đề xuất: ${addOnTime(item.proposedEndAt)} (giờ Việt Nam)',
        ) ||
        !mounted) {
      return;
    }
    await _perform(
      () => ref
          .read(orderAddOnsProvider(widget.scope).notifier)
          .decide(item, approve),
    );
  }

  Future<void> _withdraw(OrderAddOn item) async {
    if (!await _confirm(
          'Rút đề nghị?',
          'Đề nghị ${item.serviceName} chưa được thực hiện sẽ được rút lại.',
        ) ||
        !mounted) {
      return;
    }
    await _perform(
      () => ref.read(orderAddOnsProvider(widget.scope).notifier).withdraw(item),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(orderAddOnsProvider(widget.scope));
    final newer = state.order;
    final order =
        newer != null && newer.revision.isAfter(widget.snapshot.revision)
        ? newer
        : widget.snapshot;
    _watchExpiry(order);
    final provider = widget.scope.role == AddOnRole.provider;
    final visibleItems = order.items
        .where((item) => item.status != 'CANCELLED')
        .toList();
    if (visibleItems.isEmpty && (!order.eligible || !provider)) {
      return const SizedBox.shrink();
    }
    if (_foreground && ModalRoute.of(context)?.isCurrent == true) {
      ref.listen(orderNotificationEventsProvider, (_, value) {
        final event = value.valueOrNull;
        if (!_foreground ||
            ModalRoute.of(context)?.isCurrent != true ||
            event == null ||
            event.orderId != widget.scope.orderId ||
            event.recipientRole != (provider ? 'PROVIDER' : 'CUSTOMER') ||
            !event.event.startsWith('ORDER_ADD_ON_') ||
            !_events.add(event.id)) {
          return;
        }
        if (_events.length > 64) _events.remove(_events.first);
        unawaited(_refresh());
      });
    }
    final safety = ref.watch(
      orderSafetyProvider(
        SafetyScope(
          widget.scope.orderId,
          provider ? SafetyRole.provider : SafetyRole.customer,
        ),
      ),
    );
    final disabled =
        state.busy ||
        state.needsRefresh ||
        _syncing ||
        widget.mutationBlocked ||
        safety.blocksOrder;
    final outstanding = visibleItems
        .where((item) => item.status == 'PENDING')
        .toList();
    final closed = visibleItems
        .where((item) => item.status != 'PENDING' && item.status != 'ACCEPTED')
        .toList();
    final visible = [...outstanding, if (closed.isNotEmpty) closed.last];
    final canProposeNow = provider && order.canPropose(DateTime.now());
    if (visibleItems.isEmpty &&
        state.error == null &&
        !state.needsRefresh &&
        canProposeNow) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: SizedBox(
          width: double.infinity,
          height: 46,
          child: OutlinedButton.icon(
            onPressed: disabled ? null : () => _propose(order),
            icon: const Icon(Icons.add_circle_outline, size: 19),
            label: const Text(
              'Đề nghị thêm dịch vụ',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF005C55),
              backgroundColor: const Color(0xFFF0FDFA),
              side: const BorderSide(color: Color(0xFF99F6E4)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      );
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.add_task_rounded,
                size: 18,
                color: Color(0xFF005C55),
              ),
              SizedBox(width: 8),
              Text(
                'Dịch vụ phát sinh',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          AddOnLineItems(order: order, provider: provider),
          if (state.busy || _syncing) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (state.error != null) ...[
            const SizedBox(height: 8),
            Text(
              state.error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            TextButton(
              onPressed: state.busy || _syncing
                  ? null
                  : () async {
                      await ref
                          .read(orderAddOnsProvider(widget.scope).notifier)
                          .refresh();
                      await _refresh();
                    },
              child: const Text('Tải lại trạng thái'),
            ),
          ],
          for (final item in visible)
            AddOnProposalTile(
              item: item,
              currency: order.currencyCode,
              provider: provider,
              canAct: !disabled && order.eligible,
              now: DateTime.now(),
              onApprove: () => _decide(item, true, order.currencyCode),
              onReject: () => _decide(item, false, order.currencyCode),
              onWithdraw: () => _withdraw(item),
            ),
          if (canProposeNow) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: disabled ? null : () => _propose(order),
                icon: const Icon(Icons.add_circle_outline, size: 18),
                label: const Text('Đề nghị thêm dịch vụ'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF005C55),
                  side: const BorderSide(color: Color(0xFF99F6E4)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  void dispose() {
    _expiry?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
