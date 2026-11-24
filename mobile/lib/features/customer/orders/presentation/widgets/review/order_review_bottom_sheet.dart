import 'package:flutter/material.dart';

class OrderReviewBottomSheet extends StatefulWidget {
  final String providerName;
  final String serviceName;
  final Future<bool> Function(int rating, String? comment) onConfirm;

  const OrderReviewBottomSheet({
    super.key,
    required this.providerName,
    required this.serviceName,
    required this.onConfirm,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String providerName,
    required String serviceName,
    required Future<bool> Function(int rating, String? comment) onConfirm,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => OrderReviewBottomSheet(
        providerName: providerName,
        serviceName: serviceName,
        onConfirm: onConfirm,
      ),
    );
  }

  @override
  State<OrderReviewBottomSheet> createState() => _OrderReviewBottomSheetState();
}

class _OrderReviewBottomSheetState extends State<OrderReviewBottomSheet> {
  int _selectedRating = 5;
  final TextEditingController _commentController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _submit() async {
    setState(() => _isSubmitting = true);
    final comment = _commentController.text.trim();
    final success = await widget.onConfirm(
      _selectedRating,
      comment.isNotEmpty ? comment : null,
    );
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
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Đánh giá chất lượng dịch vụ',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Chuyên viên ${widget.providerName} • ${widget.serviceName}',
            style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          // 5 sao rating
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (index) {
              final star = index + 1;
              final isFilled = star <= _selectedRating;
              return IconButton(
                onPressed: () {
                  setState(() => _selectedRating = star);
                },
                iconSize: 36,
                icon: Icon(
                  isFilled ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: isFilled
                      ? const Color(0xFFF59E0B)
                      : const Color(0xFFCBD5E1),
                ),
              );
            }),
          ),
          Text(
            _getRatingLabel(_selectedRating),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFFB45309),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _commentController,
            maxLines: 3,
            maxLength: 1000,
            decoration: InputDecoration(
              hintText: 'Nhận xét của bạn về trải nghiệm phục vụ (tùy chọn)...',
              hintStyle: const TextStyle(
                fontSize: 12.5,
                color: Color(0xFF94A3B8),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF0F766E)),
              ),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
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
                      'Gửi đánh giá',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  String _getRatingLabel(int star) {
    switch (star) {
      case 5:
        return 'Tuyệt vời, rất hài lòng!';
      case 4:
        return 'Hài lòng với dịch vụ';
      case 3:
        return 'Bình thường';
      case 2:
        return 'Chưa được tốt';
      case 1:
        return 'Rất không hài lòng';
      default:
        return '';
    }
  }
}
