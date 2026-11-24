import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class SuspendMemberDialog extends StatefulWidget {
  final String memberName;
  final bool isSuspending; // true: suspend, false: reactivate

  const SuspendMemberDialog({
    super.key,
    required this.memberName,
    this.isSuspending = true,
  });

  static Future<String?> show(
    BuildContext context, {
    required String memberName,
    bool isSuspending = true,
  }) {
    return showDialog<String>(
      context: context,
      builder: (ctx) => SuspendMemberDialog(
        memberName: memberName,
        isSuspending: isSuspending,
      ),
    );
  }

  @override
  State<SuspendMemberDialog> createState() => _SuspendMemberDialogState();
}

class _SuspendMemberDialogState extends State<SuspendMemberDialog> {
  final _reasonCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.isSuspending
        ? 'Tạm đình chỉ nhân viên'
        : 'Khôi phục nhân viên';
    final actionText = widget.isSuspending ? 'Đình chỉ' : 'Khôi phục';
    final actionColor = widget.isSuspending
        ? AppColors.error
        : AppColors.primary;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
      ),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.isSuspending
                  ? 'Bạn có chắc chắn muốn tạm đình chỉ ${widget.memberName}? Nhân viên này sẽ không thể tiếp tục nhận đơn mới.'
                  : 'Khôi phục quyền làm việc cho ${widget.memberName}.',
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF4B5563),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                labelText:
                    'Lý do (${widget.isSuspending ? 'bắt buộc' : 'tùy chọn'})',
                hintText: widget.isSuspending
                    ? 'Ví dụ: Nghỉ phép dài ngày / Vi phạm nội quy...'
                    : 'Ghi chú khôi phục...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: const Color(0xFFF8F9FF),
              ),
              validator: (value) {
                if (widget.isSuspending &&
                    (value == null || value.trim().length < 5)) {
                  return 'Vui lòng nhập lý do tối thiểu 5 ký tự.';
                }
                return null;
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              Navigator.pop(context, _reasonCtrl.text.trim());
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: actionColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: Text(actionText),
        ),
      ],
    );
  }
}
