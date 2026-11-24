import 'package:flutter/material.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../../domain/entities/booking_draft_entity.dart';

class BookingConfigBottomBar extends StatelessWidget {
  final BookingDraftEntity draft;
  final VoidCallback onContinue;
  final bool continueToQuote;

  const BookingConfigBottomBar({
    super.key,
    required this.draft,
    required this.onContinue,
    this.continueToQuote = false,
  });

  @override
  Widget build(BuildContext context) {
    final isValid = draft.isConfigValid;

    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        14,
        20,
        MediaQuery.of(context).padding.bottom + 14,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: isValid
              ? onContinue
              : () {
                  _showValidationFeedback(context);
                },
          style: ElevatedButton.styleFrom(
            backgroundColor: isValid
                ? const Color(0xFF0F766E)
                : const Color(0xFF94A3B8),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(100),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                continueToQuote ? 'Xem báo giá' : 'Tiếp tục chọn chuyên viên',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_rounded, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  void _showValidationFeedback(BuildContext context) {
    String message = 'Vui lòng hoàn thiện thông tin đặt lịch.';
    if (!draft.hasValidAddress) {
      message = 'Vui lòng chọn hoặc thêm địa chỉ đón chuyên viên.';
    } else if (draft.contactName.trim().length < 2) {
      message = 'Vui lòng nhập họ và tên người nhận (tối thiểu 2 ký tự).';
    } else if (!draft.hasValidContact) {
      message = 'Số điện thoại người nhận chưa đúng định dạng (10 số).';
    } else if (!draft.hasValidTime) {
      message = 'Thời gian hẹn phải từ 60 phút trở lên so với hiện tại.';
    }

    AppDialog.warning(
      context,
      title: 'Thông tin chưa đầy đủ',
      message: message,
    );
  }
}
