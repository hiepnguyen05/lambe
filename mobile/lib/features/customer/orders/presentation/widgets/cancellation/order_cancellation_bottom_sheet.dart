import 'package:flutter/material.dart';

class OrderCancellationBottomSheet extends StatefulWidget {
  final Future<bool> Function(String reason) onConfirm;

  const OrderCancellationBottomSheet({super.key, required this.onConfirm});

  static Future<bool?> show(
    BuildContext context, {
    required Future<bool> Function(String reason) onConfirm,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => OrderCancellationBottomSheet(onConfirm: onConfirm),
    );
  }

  @override
  State<OrderCancellationBottomSheet> createState() =>
      _OrderCancellationBottomSheetState();
}

class _OrderCancellationBottomSheetState
    extends State<OrderCancellationBottomSheet> {
  final TextEditingController _reasonController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorText;

  final List<String> _quickReasons = [
    'Tôi bận việc đột xuất',
    'Tôi muốn đổi ngày giờ khác',
    'Tôi chọn nhầm dịch vụ',
    'Thợ phản hồi quá lâu',
  ];

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  void _submit() async {
    final reason = _reasonController.text.trim();
    if (reason.length < 3) {
      setState(() {
        _errorText = 'Lý do hủy phải có ít nhất 3 ký tự.';
      });
      return;
    }
    if (reason.length > 500) {
      setState(() {
        _errorText = 'Lý do hủy tối đa 500 ký tự.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorText = null;
    });

    final success = await widget.onConfirm(reason);
    if (!mounted) return;

    setState(() => _isSubmitting = false);
    if (success) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Row(
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFDC2626),
                size: 22,
              ),
              SizedBox(width: 8),
              Text(
                'Xác nhận hủy đơn đặt lịch',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Vui lòng chia sẻ lý do hủy đơn để Lambe và chuyên viên ghi nhận hỗ trợ tốt hơn.',
            style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _quickReasons.map((r) {
              return InkWell(
                onTap: () {
                  _reasonController.text = r;
                  setState(() => _errorText = null);
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    r,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reasonController,
            maxLines: 3,
            maxLength: 500,
            decoration: InputDecoration(
              hintText: 'Nhập chi tiết lý do của bạn (3–500 ký tự)...',
              hintStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF94A3B8),
              ),
              errorText: _errorText,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626)),
              ),
              contentPadding: const EdgeInsets.all(12),
            ),
            onChanged: (_) {
              if (_errorText != null) {
                setState(() => _errorText = null);
              }
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 46,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    child: const Text(
                      'Quay lại',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF475569),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Xác nhận hủy',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
