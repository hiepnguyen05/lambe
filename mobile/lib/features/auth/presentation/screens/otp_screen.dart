import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/auth_providers.dart';
import '../../domain/exceptions/auth_flow_exception.dart';

import 'package:mobile/core/utils/app_dialogs.dart';

class OtpScreen extends ConsumerStatefulWidget {
  final String phone;
  final bool isLinking;

  const OtpScreen({super.key, required this.phone, this.isLinking = false});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final TextEditingController _otpController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 300), () {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _otpController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _verifyOtp() {
    if (_otpController.text.length == 6) {
      ref
          .read(authNotifierProvider.notifier)
          .verifyOtp(_otpController.text, isLinking: widget.isLinking);
    }
  }

  String _extractFirebaseErrorMessage(Object? error) {
    final errStr = error.toString();
    if (errStr.contains('invalid-verification-code')) {
      return 'Mã xác thực không chính xác, vui lòng thử lại.';
    }
    return 'Có lỗi xảy ra: ${errStr.split("]").last.trim()}';
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    // Xử lý khi auth state báo lỗi
    ref.listen<AsyncValue>(authNotifierProvider, (_, state) {
      if (!state.isLoading && state.hasError) {
        final error = state.error;
        if (error is RegistrationRequiredException) {
          context.pushReplacement(
            '/auth/complete-registration',
            extra: error.registrationToken,
          );
        } else if (error is PhoneVerificationRequiredException) {
          context.pushReplacement('/auth/link-phone');
        } else {
          AppDialogs.showErrorDialog(
            context,
            message: _extractFirebaseErrorMessage(error),
          );
        }
      }
      if (!state.isLoading && !state.hasError && state.value != null) {
        final user = state.value!;
        if (user.onboardingStatus == 'COMPLETED' ||
            user.onboardingStatus == 'SKIPPED') {
          context.go('/home');
        } else {
          context.go('/onboarding');
        }
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'Nhập mã xác thực',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                  ),
                ),
                const SizedBox(height: 12),
                RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF3E4947),
                      height: 1.5,
                    ),
                    children: [
                      const TextSpan(
                        text: 'Mã 6 số đã được gửi tới số điện thoại\n',
                      ),
                      TextSpan(
                        text: widget.phone,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () => context.pop(),
                  child: const Text(
                    'Thay đổi số điện thoại',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF005C55),
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                // OTP Input Boxes
                GestureDetector(
                  onTap: () => _focusNode.requestFocus(),
                  child: SizedBox(
                    height: 64,
                    child: Stack(
                      children: [
                        // Các ô vuông hiển thị số
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(6, (index) {
                            final text = _otpController.text;
                            final char = index < text.length ? text[index] : '';
                            final isFocused = index == text.length;

                            return Container(
                              width: 48,
                              height: 64,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isFocused
                                      ? const Color(0xFF005C55)
                                      : const Color(0xFFBDC9C6)
                                            .withValues(alpha: 0.3),
                                  width: isFocused ? 2 : 1,
                                ),
                              ),
                              child: Text(
                                char,
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0B1C30),
                                ),
                              ),
                            );
                          }),
                        ),
                        // Input ẩn để hứng bàn phím
                        Opacity(
                          opacity: 0,
                          child: TextField(
                            controller: _otpController,
                            focusNode: _focusNode,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            maxLength: 6,
                            onChanged: (val) {
                              setState(() {});
                              if (val.length == 6) {
                                _verifyOtp();
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 40),

                // Nút xác nhận
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed:
                        _otpController.text.length == 6 && !authState.isLoading
                        ? _verifyOtp
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(0xFF0F766E)
                          .withValues(alpha: 0.5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(100),
                      ),
                      elevation: 4,
                    ),
                    child: authState.isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'Xác nhận mã',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),

                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Chưa nhận được mã? ',
                      style: TextStyle(color: Color(0xFF3E4947), fontSize: 14),
                    ),
                    TextButton(
                      onPressed: () {
                        // Gửi lại mã
                        ref
                            .read(authNotifierProvider.notifier)
                            .sendOtp(
                              widget.phone,
                              isLinking: widget.isLinking,
                              onCodeSent: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Đã gửi lại mã OTP'),
                                  ),
                                );
                              },
                            );
                      },
                      child: const Text(
                        'Gửi lại',
                        style: TextStyle(
                          color: Color(0xFF005C55),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
