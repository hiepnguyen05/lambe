import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../application/payment_dispute_controller.dart';
import '../domain/payment_dispute_order.dart';
import 'payment_dispute_summary.dart';
import 'payment_dispute_updates.dart';

class PaymentDisputeScreen extends ConsumerWidget {
  final PaymentDisputeScope scope;
  final PaymentDisputeOrder snapshot;
  final Future<void> Function() refreshOrder;
  final void Function(Map<String, dynamic>)? onServerOrder;
  final String? error;
  const PaymentDisputeScreen({
    super.key,
    required this.scope,
    required this.snapshot,
    required this.refreshOrder,
    this.onServerOrder,
    this.error,
  });
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = scope.role == PaymentDisputeRole.provider;
    final local = provider
        ? ref.watch(paymentDisputeProvider(scope))
        : const PaymentDisputeState();
    Future<void> refresh() async {
      if (provider) {
        final json = await ref
            .read(paymentDisputeProvider(scope).notifier)
            .refresh();
        if (json != null && context.mounted) onServerOrder?.call(json);
      } else {
        await refreshOrder();
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Đối soát thanh toán'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop()
              ? context.pop()
              : context.go(provider ? '/provider/orders' : '/appointments'),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            PaymentDisputeUpdates(scope: scope, refreshOrder: refresh),
            if (local.opening)
              const ListTile(
                leading: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(),
                ),
                title: Text('Đang gửi báo cáo thanh toán…'),
              )
            else if (snapshot.active || snapshot.hasHistory)
              PaymentDisputeSummary(order: snapshot, role: scope.role),
            if (local.uncertain)
              const Text(
                'Chưa xác nhận được kết quả gửi. Hãy tải lại trạng thái trước khi thao tác đơn.',
              ),
            if (local.error ?? error case final String message)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  message,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (!local.opening)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'Trạng thái và kết quả xác minh do hệ thống cập nhật. Khi chưa được xác nhận thanh toán, đơn chưa hoàn thành.',
                ),
              ),
            OutlinedButton.icon(
              onPressed: local.busy ? null : refresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Tải lại trạng thái'),
            ),
          ],
        ),
      ),
    );
  }
}
