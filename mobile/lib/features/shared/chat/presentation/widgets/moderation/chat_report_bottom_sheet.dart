import 'package:flutter/material.dart';

class ChatReportBottomSheet extends StatefulWidget {
  final Future<bool> Function({required String reason, String? detail})
  onSubmit;

  const ChatReportBottomSheet({super.key, required this.onSubmit});

  static Future<bool?> show(
    BuildContext context, {
    required Future<bool> Function({required String reason, String? detail})
    onSubmit,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ChatReportBottomSheet(onSubmit: onSubmit),
    );
  }

  @override
  State<ChatReportBottomSheet> createState() => _ChatReportBottomSheetState();
}

class _ChatReportBottomSheetState extends State<ChatReportBottomSheet> {
  String _selectedReason = 'SPAM';
  final TextEditingController _detailController = TextEditingController();
  bool _isSubmitting = false;

  final List<Map<String, String>> _reasons = [
    {
      'code': 'SPAM',
      'title': 'Tin rác / Quảng cáo',
      'desc': 'Gửi tin nhắn spam, quảng cáo dịch vụ trái phép.',
    },
    {
      'code': 'HARASSMENT',
      'title': 'Quấy rối / Khiếm nhã',
      'desc': 'Dùng từ ngữ khiếm nhã, đe dọa hoặc quấy rối.',
    },
    {
      'code': 'SCAM',
      'title': 'Lừa đảo / Giao dịch ngoài sàn',
      'desc': 'Dụ dỗ chuyển khoản cá nhân hoặc lừa gạt tiền bạc.',
    },
    {
      'code': 'INAPPROPRIATE_CONTENT',
      'title': 'Nội dung phản cảm',
      'desc': 'Hình ảnh hoặc nội dung không lành mạnh.',
    },
    {
      'code': 'OTHER',
      'title': 'Lý do khác',
      'desc': 'Các hành vi vi phạm quy chuẩn cộng đồng khác.',
    },
  ];

  @override
  void dispose() {
    _detailController.dispose();
    super.dispose();
  }

  Future<void> _handleConfirm() async {
    setState(() => _isSubmitting = true);
    final success = await widget.onSubmit(
      reason: _selectedReason,
      detail: _detailController.text.trim().isEmpty
          ? null
          : _detailController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
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
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  color: Color(0xFFDC2626),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Báo cáo vi phạm',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Hãy chọn lý do bạn muốn báo cáo cuộc trò chuyện này để ban quản trị Lambe kiểm tra và xử lý:',
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 280),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: _reasons.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = _reasons[index];
                final isSelected = _selectedReason == item['code'];

                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedReason = item['code']!;
                    });
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFFEF2F2)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFFDC2626)
                            : const Color(0xFFE2E8F0),
                        width: isSelected ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          isSelected
                              ? Icons.radio_button_checked_rounded
                              : Icons.radio_button_off_rounded,
                          size: 18,
                          color: isSelected
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['title']!,
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected
                                      ? const Color(0xFFDC2626)
                                      : const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                item['desc']!,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _detailController,
            maxLines: 2,
            maxLength: 500,
            decoration: InputDecoration(
              hintText: 'Mô tả thêm chi tiết vi phạm (không bắt buộc)...',
              hintStyle: const TextStyle(
                fontSize: 12.5,
                color: Color(0xFF94A3B8),
              ),
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDC2626)),
              ),
              counterText: '',
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _handleConfirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
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
                      'Gửi báo cáo vi phạm',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
