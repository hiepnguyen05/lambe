import 'package:flutter/material.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

class ProviderCancellationBottomSheet extends StatefulWidget {
  final String status;
  final List<dynamic> evidenceList;
  final List<dynamic> contactAttempts;
  final Future<bool> Function() onPickIncident;
  final Future<bool> Function(String reason, String detail) onSubmit;

  const ProviderCancellationBottomSheet({
    super.key,
    required this.status,
    required this.evidenceList,
    required this.contactAttempts,
    required this.onPickIncident,
    required this.onSubmit,
  });

  static Future<void> show(
    BuildContext context, {
    required String status,
    required List<dynamic> evidenceList,
    required List<dynamic> contactAttempts,
    required Future<bool> Function() onPickIncident,
    required Future<bool> Function(String reason, String detail) onSubmit,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ProviderCancellationBottomSheet(
        status: status,
        evidenceList: evidenceList,
        contactAttempts: contactAttempts,
        onPickIncident: onPickIncident,
        onSubmit: onSubmit,
      ),
    );
  }

  @override
  State<ProviderCancellationBottomSheet> createState() =>
      _ProviderCancellationBottomSheetState();
}

class _ProviderCancellationBottomSheetState
    extends State<ProviderCancellationBottomSheet> {
  final TextEditingController _controller = TextEditingController();
  late String _selectedReason;
  late final List<Map<String, String>> _reasons;
  late bool _hasIncident;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _hasIncident = widget.evidenceList.any((e) => e['type'] == 'INCIDENT');
    if (widget.status == 'EN_ROUTE') {
      _reasons = [
        {
          'code': 'TRANSPORT_ISSUE',
          'title': 'Sự cố di chuyển (hỏng xe, sự cố giao thông)',
        },
        {
          'code': 'LOCATION_INACCESSIBLE',
          'title': 'Không thể tiếp cận địa điểm hẹn',
        },
        {'code': 'OTHER', 'title': 'Lý do khác'},
      ];
    } else if (widget.status == 'ARRIVED') {
      _reasons = [
        {
          'code': 'CUSTOMER_UNREACHABLE',
          'title':
              'Không liên hệ được khách (cần ít nhất 2 cuộc gọi cách nhau 5p)',
        },
        {
          'code': 'UNSAFE_CONDITIONS',
          'title': 'Điều kiện làm việc không an toàn',
        },
        {
          'code': 'LOCATION_INACCESSIBLE',
          'title': 'Không thể tiếp cận địa điểm hẹn',
        },
        {'code': 'OTHER', 'title': 'Lý do khác'},
      ];
    } else if (widget.status == 'IN_PROGRESS') {
      _reasons = [
        {
          'code': 'UNSAFE_CONDITIONS',
          'title': 'Điều kiện làm việc không an toàn / có sự cố phát sinh',
        },
        {'code': 'OTHER', 'title': 'Lý do khác'},
      ];
    } else {
      _reasons = [
        {'code': 'OTHER', 'title': 'Lý do khác'},
      ];
    }
    _selectedReason = _reasons.first['code']!;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final requiresIncident = _selectedReason != 'CUSTOMER_UNREACHABLE';
    final attemptTimes =
        widget.contactAttempts
            .whereType<Map>()
            .map(
              (attempt) =>
                  DateTime.tryParse(attempt['attemptedAt']?.toString() ?? ''),
            )
            .whereType<DateTime>()
            .toList()
          ..sort();
    final hasEnoughContactAttempts =
        attemptTimes.length >= 2 &&
        attemptTimes.last.difference(attemptTimes.first) >=
            const Duration(minutes: 5);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Báo sự cố & Yêu cầu hủy đơn',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF991B1B),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.status == 'IN_PROGRESS'
                  ? 'Khi đơn đang thực hiện, bạn chỉ có thể báo sự cố bất khả kháng hoặc điều kiện không an toàn. Yêu cầu sẽ gửi đến khách hàng phê duyệt.'
                  : 'Yêu cầu hủy sẽ gửi tới khách hàng xác nhận hoặc chuyển tổ hỗ trợ nếu có tranh chấp.',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 14),
            const Text(
              'Chọn lý do phù hợp:',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 8),
            ..._reasons.map((r) {
              final isSelected = _selectedReason == r['code'];
              return InkWell(
                onTap: () {
                  setState(() => _selectedReason = r['code']!);
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFFFEF2F2)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFFFCA5A5)
                          : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isSelected
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_unchecked_rounded,
                        size: 18,
                        color: isSelected
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          r['title']!,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.normal,
                            color: isSelected
                                ? const Color(0xFF991B1B)
                                : const Color(0xFF334155),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 10),
            if (requiresIncident) ...[
              if (!_hasIncident)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(
                            Icons.warning_amber_rounded,
                            color: Color(0xFFDC2626),
                            size: 18,
                          ),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Cần có ảnh ghi nhận sự cố',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: Color(0xFF991B1B),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Hệ thống yêu cầu ảnh sự cố trước khi gửi để bảo vệ quyền lợi và xác minh.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF7F1D1D),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        height: 38,
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final uploaded = await widget.onPickIncident();
                            if (uploaded && mounted) {
                              setState(() => _hasIncident = true);
                            }
                          },
                          icon: const Icon(Icons.camera_alt_outlined, size: 16),
                          label: const Text(
                            'Thêm ảnh sự cố',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            side: const BorderSide(color: Color(0xFFDC2626)),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Row(
                    children: const [
                      Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF16A34A),
                        size: 18,
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Đã có ảnh sự cố hợp lệ trong hệ thống.',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF15803D),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
            if (_selectedReason == 'CUSTOMER_UNREACHABLE' &&
                !hasEnoughContactAttempts) ...[
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Cần thử gọi khách ít nhất hai lần, cách nhau 5 phút. Quay lại đơn để gọi và thử gửi yêu cầu sau.',
                  style: TextStyle(color: Color(0xFF991B1B), fontSize: 12),
                ),
              ),
            ],
            TextField(
              controller: _controller,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                hintText: 'Mô tả sự cố (tối thiểu 10 ký tự)...',
                hintStyle: const TextStyle(fontSize: 12.5),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFDC2626)),
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: _isSubmitting
                    ? null
                    : () async {
                        if (requiresIncident && !_hasIncident) {
                          AppDialog.warning(
                            context,
                            message: 'Vui lòng chụp / tải ảnh sự cố trước khi gửi yêu cầu hủy.',
                          );
                          return;
                        }
                        if (_selectedReason == 'CUSTOMER_UNREACHABLE' &&
                            !hasEnoughContactAttempts) {
                          AppDialog.warning(
                            context,
                            message:
                                'Cần hai lần thử gọi cách nhau ít nhất 5 phút.',
                          );
                          return;
                        }
                        final detail = _controller.text.trim();
                        if (detail.length < 10) {
                          AppDialog.warning(
                            context,
                            message: 'Vui lòng mô tả sự cố ít nhất 10 ký tự.',
                          );
                          return;
                        }
                        setState(() => _isSubmitting = true);
                        final submitted = await widget.onSubmit(
                          _selectedReason,
                          detail,
                        );
                        if (!context.mounted) return;
                        setState(() => _isSubmitting = false);
                        if (submitted) Navigator.of(context).pop();
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  foregroundColor: Colors.white,
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
                        'Gửi yêu cầu hủy',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
