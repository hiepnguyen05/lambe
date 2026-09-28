import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import 'otp_pin_input.dart';

class OtpInputCard extends StatefulWidget {
  final TextEditingController controller;
  final GlobalKey<FormState> formKey;
  final String phone;
  final bool isLoading;
  final VoidCallback onVerify;
  final VoidCallback onResend;
  final VoidCallback? onChangePhone;

  const OtpInputCard({
    super.key,
    required this.controller,
    required this.formKey,
    required this.phone,
    required this.isLoading,
    required this.onVerify,
    required this.onResend,
    this.onChangePhone,
  });

  @override
  State<OtpInputCard> createState() => _OtpInputCardState();
}

class _OtpInputCardState extends State<OtpInputCard> {
  Timer? _timer;
  int _startSeconds = 60;
  bool _canResend = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    setState(() {
      _startSeconds = 60;
      _canResend = false;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_startSeconds <= 1) {
        timer.cancel();
        setState(() => _canResend = true);
      } else {
        setState(() => _startSeconds--);
      }
    });
  }

  void _handleResend() {
    if (_canResend) {
      widget.onResend();
      _startTimer();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatPhone(String rawPhone) {
    if (rawPhone.startsWith('84')) {
      rawPhone = '0${rawPhone.substring(2)}';
    }
    if (rawPhone.length == 10) {
      return '${rawPhone.substring(0, 4)} ${rawPhone.substring(4, 7)} ${rawPhone.substring(7)}';
    }
    return rawPhone;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.outlineVariant.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: widget.formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title & Phone Info
            Text(
              'Xác thực mã OTP',
              style: AppTypography.headlineSm.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: AppTypography.bodyMd.copyWith(fontSize: 13),
                      children: [
                        const TextSpan(text: 'Mã 6 chữ số đã gửi đến '),
                        TextSpan(
                          text: _formatPhone(widget.phone),
                          style: AppTypography.bodyMd.copyWith(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: AppColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (widget.onChangePhone != null)
                  InkWell(
                    onTap: widget.onChangePhone,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 2.0),
                      child: Text(
                        'Đổi số',
                        style: AppTypography.labelMd.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 24),

            // 6-Digit Separate Pin Input Boxes
            OtpPinInput(
              length: 6,
              controller: widget.controller,
              onCompleted: (_) {
                if (!widget.isLoading) {
                  widget.onVerify();
                }
              },
            ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: widget.isLoading ? null : widget.onVerify,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                  shape: const StadiumBorder(),
                  elevation: 0,
                ),
                child: widget.isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Xác nhận OTP',
                            style: AppTypography.button.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward, size: 20),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 16),

            // Resend Timer Row
            Center(
              child: _canResend
                  ? TextButton.icon(
                      onPressed: widget.isLoading ? null : _handleResend,
                      icon: const Icon(Icons.refresh, size: 18, color: AppColors.primary),
                      label: Text(
                        'Gửi lại mã OTP ngay',
                        style: AppTypography.button.copyWith(
                          color: AppColors.primary,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    )
                  : Text(
                      'Gửi lại mã sau 00:${_startSeconds.toString().padLeft(2, '0')}s',
                      style: AppTypography.bodyMd.copyWith(
                        color: AppColors.outline,
                        fontSize: 13,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
