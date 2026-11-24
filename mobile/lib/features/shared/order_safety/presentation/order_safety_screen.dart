import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/order_safety_controller.dart';
import '../domain/order_safety.dart';
import 'order_safety_button.dart';
import 'order_safety_evidence.dart';

class OrderSafetyScreen extends ConsumerStatefulWidget {
  final SafetyScope scope;
  final Future<void> Function() refreshOrder;
  const OrderSafetyScreen({
    super.key,
    required this.scope,
    required this.refreshOrder,
  });
  @override
  ConsumerState<OrderSafetyScreen> createState() => _OrderSafetyScreenState();
}

class _OrderSafetyScreenState extends ConsumerState<OrderSafetyScreen>
    with WidgetsBindingObserver {
  Timer? _timer;
  bool _foreground = true;
  bool _refreshing = false;
  @override
  void initState() {
    super.initState();
    _foreground =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(_refresh);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted &&
          _foreground &&
          ModalRoute.of(context)?.isCurrent == true &&
          ref.read(orderSafetyProvider(widget.scope)).incident?.status !=
              'CLOSED') {
        unawaited(_refresh(refreshOrder: false));
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground && ModalRoute.of(context)?.isCurrent == true) {
      unawaited(_refresh());
    }
  }

  Future<void> _refresh({bool refreshOrder = true}) async {
    if (!mounted || !_foreground || _refreshing) return;
    _refreshing = true;
    try {
      await ref.read(orderSafetyProvider(widget.scope).notifier).refresh();
      if (mounted &&
          !ref.read(orderSafetyProvider(widget.scope)).submitting &&
          (refreshOrder ||
              ref.read(orderSafetyProvider(widget.scope)).incident?.status ==
                  'CLOSED')) {
        await widget.refreshOrder();
      }
    } finally {
      _refreshing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(orderSafetyProvider(widget.scope));
    final incident = state.incident;
    return Scaffold(
      appBar: AppBar(title: const Text('An toàn đơn hàng')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Icon(
              Icons.health_and_safety_outlined,
              size: 52,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              state.submitting
                  ? 'Đang gửi SOS…'
                  : state.uncertain
                  ? 'Chưa xác nhận được kết quả SOS'
                  : incident?.status == 'CLOSED'
                  ? 'Hồ sơ an toàn đã đóng'
                  : incident?.isOpen == true
                  ? 'Đơn đang tạm dừng để chờ hỗ trợ'
                  : 'Hồ sơ an toàn đơn hàng',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            const Text(
              'Ưu tiên sự an toàn của bạn. Lambe ghi nhận báo cáo; chưa có xác nhận nhân sự đã tiếp nhận. Nếu có nguy hiểm tức thời, liên hệ dịch vụ khẩn cấp tại nơi bạn đang ở.',
            ),
            if (state.busy) const LinearProgressIndicator(),
            if (state.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  state.error!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            TextButton(
              onPressed: state.busy ? null : _refresh,
              child: const Text('Kiểm tra lại trạng thái'),
            ),
            if (state.uncertain ||
                (incident?.isOpen == true && !incident!.ownReport))
              OrderSafetyButton(scope: widget.scope),
            if (incident != null) ...[
              Text('Mã hồ sơ: ${incident.id}'),
              if (incident.closedAt != null)
                Text('Đóng lúc: ${incident.closedAt!.toLocal()}'),
              const SizedBox(height: 16),
              OrderSafetyEvidence(scope: widget.scope),
            ],
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
