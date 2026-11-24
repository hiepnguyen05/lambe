import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/customer_order_entity.dart';

class OrderCancellationDecisionCard extends StatefulWidget {
  final OrderCancellationRequestEntity request;
  final Future<bool> Function({required bool approve, String? note}) onDecide;

  const OrderCancellationDecisionCard({
    super.key,
    required this.request,
    required this.onDecide,
  });

  @override
  State<OrderCancellationDecisionCard> createState() =>
      _OrderCancellationDecisionCardState();
}

class _OrderCancellationDecisionCardState
    extends State<OrderCancellationDecisionCard> {
  bool _isSubmitting = false;
  String? _error;

  String _mapReason(String code) {
    switch (code) {
      case 'TRANSPORT_ISSUE':
        return 'Sự cố di chuyển / xe cộ';
      case 'CUSTOMER_UNREACHABLE':
        return 'Không thể liên hệ với khách hàng';
      case 'LOCATION_INACCESSIBLE':
        return 'Không thể tiếp cận địa điểm hẹn';
      case 'UNSAFE_CONDITIONS':
        return 'Điều kiện xung quanh không an toàn';
      case 'OTHER':
      default:
        return 'Lý do khác';
    }
  }

  Future<void> _handleDecision(bool approve) async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final success = await widget.onDecide(approve: approve);
      if (!success && mounted) {
        setState(() => _error = 'Chưa xử lý được yêu cầu. Vui lòng thử lại.');
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Chưa xử lý được yêu cầu. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeStr = widget.request.createdAt != null
        ? DateFormat('HH:mm - dd/MM/yyyy').format(widget.request.createdAt!)
        : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFDC2626).withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFDC2626),
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.request.status == 'SUPPORT_REVIEW'
                      ? 'Yêu cầu hủy đang chờ hỗ trợ'
                      : 'Thợ gửi yêu cầu hủy đơn',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF991B1B),
                  ),
                ),
              ),
              if (timeStr.isNotEmpty)
                Text(
                  timeStr,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFFB91C1C),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Lý do: ${_mapReason(widget.request.reason)}',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF7F1D1D),
            ),
          ),
          if (widget.request.detail != null &&
              widget.request.detail!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Ghi chú thợ: ${widget.request.detail!}',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF991B1B)),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12),
            ),
          ],
          const SizedBox(height: 12),
          if (widget.request.status == 'SUPPORT_REVIEW') ...[
            const Text(
              'Yêu cầu hủy đã chuyển sang tổ hỗ trợ. Bạn vẫn có thể bấm "Đồng ý hủy đơn ngay" để hoàn tất hủy đơn lập tức và giải phóng lịch hẹn.',
              style: TextStyle(fontSize: 12, color: Color(0xFF7F1D1D)),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : () => _handleDecision(true),
                icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                label: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Đồng ý hủy đơn ngay',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ] else ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSubmitting
                        ? null
                        : () => _handleDecision(false),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFDC2626)),
                      foregroundColor: const Color(0xFFDC2626),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Không đồng ý (Hỗ trợ)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSubmitting
                        ? null
                        : () => _handleDecision(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Đồng ý hủy đơn',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
