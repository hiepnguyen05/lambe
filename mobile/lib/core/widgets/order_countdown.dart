import 'dart:async';

import 'package:flutter/material.dart';

/// Widget chuyên biệt cách ly bộ đếm ngược thời gian,
/// chỉ vẽ lại phần widget builder khi giây thay đổi, tránh làm rebuild toàn bộ màn hình cha.
class OrderCountdown extends StatefulWidget {
  final DateTime deadline;
  final Widget Function(BuildContext, Duration) builder;
  final VoidCallback? onExpired;
  final DateTime Function() now;

  const OrderCountdown({
    super.key,
    required this.deadline,
    required this.builder,
    this.onExpired,
    this.now = DateTime.now,
  });

  @override
  State<OrderCountdown> createState() => _OrderCountdownState();
}

class _OrderCountdownState extends State<OrderCountdown> {
  Timer? _timer;
  late Duration _remaining;
  bool _notifiedExpired = false;

  @override
  void initState() {
    super.initState();
    _remaining = _timeLeft();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void didUpdateWidget(covariant OrderCountdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.deadline != widget.deadline) {
      _notifiedExpired = false;
      _remaining = _timeLeft();
      if (_timer?.isActive != true) {
        _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      }
    }
  }

  Duration _timeLeft() {
    final difference = widget.deadline.difference(widget.now());
    return difference.isNegative ? Duration.zero : difference;
  }

  void _tick() {
    final next = _timeLeft();
    if (next.inSeconds != _remaining.inSeconds) {
      setState(() => _remaining = next);
    }
    if (next == Duration.zero && !_notifiedExpired) {
      _notifiedExpired = true;
      _timer?.cancel();
      widget.onExpired?.call();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RepaintBoundary(child: widget.builder(context, _remaining));
}
