import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../domain/entities/incoming_order_entity.dart';
import './incoming_order_action_buttons.dart';
import './incoming_order_customer_card.dart';
import './incoming_order_earnings_card.dart';
import './incoming_order_header.dart';
import './incoming_order_service_info.dart';

class IncomingOrderModal extends StatefulWidget {
  final IncomingOrderEntity order;
  final Future<void> Function()? onAccept;
  final Future<bool> Function()? onReject;
  final VoidCallback? onTimeout;

  const IncomingOrderModal({
    super.key,
    required this.order,
    this.onAccept,
    this.onReject,
    this.onTimeout,
  });

  /// Hiển thị Modal Cảnh báo Đơn hàng mới cho Chuyên viên
  static Future<bool?> show(
    BuildContext context, {
    required IncomingOrderEntity order,
    Future<void> Function()? onAccept,
    Future<bool> Function()? onReject,
    VoidCallback? onTimeout,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (ctx) => IncomingOrderModal(
        order: order,
        onAccept: onAccept,
        onReject: onReject,
        onTimeout: onTimeout,
      ),
    );
  }

  @override
  State<IncomingOrderModal> createState() => _IncomingOrderModalState();
}

class _IncomingOrderModalState extends State<IncomingOrderModal>
    with SingleTickerProviderStateMixin {
  late int _remainingSeconds;
  late final int _totalSeconds;
  Timer? _timer;
  bool _isSubmitting = false;
  String? _actionError;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.order.countdownSeconds;
    _totalSeconds = widget.order.countdownSeconds;

    // Rung nhẹ khi có đơn hàng mới xuất hiện
    HapticFeedback.heavyImpact();

    // Khởi tạo đếm ngược
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      if (_remainingSeconds > 1) {
        setState(() {
          _remainingSeconds--;
        });
        // Haptic feedback nhẹ ở 5 giây cuối
        if (_remainingSeconds <= 5) {
          HapticFeedback.selectionClick();
        }
      } else {
        timer.cancel();
        _handleTimeout();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _handleTimeout() {
    if (!mounted) return;
    widget.onTimeout?.call();
    Navigator.of(context).pop(null);
  }

  Future<void> _handleAccept() async {
    _timer?.cancel();
    setState(() {
      _isSubmitting = true;
      _actionError = null;
    });

    try {
      if (widget.onAccept != null) {
        await widget.onAccept!();
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _actionError = 'Không thể nhận đơn hàng. Vui lòng thử lại.';
        });
      }
    }
  }

  Future<void> _handleReject() async {
    _timer?.cancel();
    setState(() {
      _isSubmitting = true;
      _actionError = null;
    });

    final rejected = widget.onReject == null ? true : await widget.onReject!();
    if (!mounted) return;
    if (rejected) {
      Navigator.of(context).pop(false);
    } else {
      setState(() {
        _isSubmitting = false;
        _actionError =
            'Không thể từ chối đơn hàng. Vui lòng kiểm tra mạng và thử lại.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
          child: Material(
            color: Colors.transparent,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.18),
                    blurRadius: 36,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. Header & Thanh tiến trình đếm ngược
                  IncomingOrderHeader(
                    isAsap: widget.order.isAsap,
                    remainingSeconds: _remainingSeconds,
                    totalSeconds: _totalSeconds,
                  ),

                  const SizedBox(height: 14),

                  // 2. Khối thu nhập thực nhận & thời gian có mặt
                  IncomingOrderEarningsCard(
                    earningsAmount: widget.order.earningsAmount,
                    durationMinutes: widget.order.durationMinutes,
                    arrivalMinutes: widget.order.arrivalMinutes,
                    timeWindow: widget.order.timeWindow,
                  ),

                  const SizedBox(height: 14),

                  // 3. Tên & mô tả dịch vụ
                  IncomingOrderServiceInfo(
                    serviceName: widget.order.serviceName,
                    serviceDescription: widget.order.serviceDescription,
                  ),

                  const SizedBox(height: 14),

                  // 4. Khách hàng & Địa chỉ di chuyển
                  IncomingOrderCustomerCard(
                    customerName: widget.order.customerName,
                    customerAvatarUrl: widget.order.customerAvatarUrl,
                    isVip: widget.order.isVip,
                    rating: widget.order.rating,
                    bookingCount: widget.order.bookingCount,
                    address: widget.order.address,
                    distanceKm: widget.order.distanceKm,
                    customerNote: widget.order.customerNote,
                  ),

                  if (_actionError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _actionError!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // 5. Nút Từ chối & Nhận đơn
                  IncomingOrderActionButtons(
                    remainingSeconds: _remainingSeconds,
                    onReject: _handleReject,
                    onAccept: _handleAccept,
                    isAccepting: _isSubmitting,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
