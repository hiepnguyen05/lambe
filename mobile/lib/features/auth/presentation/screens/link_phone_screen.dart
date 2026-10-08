import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/auth_providers.dart';
import '../widgets/phone_input_field.dart';

import 'package:mobile/core/utils/app_dialogs.dart';

class LinkPhoneScreen extends ConsumerStatefulWidget {
  const LinkPhoneScreen({super.key});

  @override
  ConsumerState<LinkPhoneScreen> createState() => _LinkPhoneScreenState();
}

class _LinkPhoneScreenState extends ConsumerState<LinkPhoneScreen> {
  String _phone = '';

  String _extractFirebaseErrorMessage(Object? error) {
    final errStr = error.toString();
    if (errStr.contains('invalid-phone-number') ||
        errStr.contains('17042') ||
        errStr.contains('format of the phone number')) {
      return 'Số điện thoại không hợp lệ, vui lòng kiểm tra lại.';
    }
    if (errStr.contains('too-many-requests')) {
      return 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.';
    }
    if (errStr.contains('credential-already-in-use')) {
      return 'Số điện thoại này đã được liên kết với một tài khoản khác.';
    }
    return 'Có lỗi xảy ra, vui lòng thử lại: ${errStr.split("]").last.trim()}';
  }

  void _handleLinkPhone() {
    if (_phone.length >= 9) {
      ref
          .read(authNotifierProvider.notifier)
          .sendOtp(
            _phone,
            isLinking: true,
            onCodeSent: () {
              context.push(
                '/auth/otp',
                extra: {'phone': _phone, 'isLinking': true},
              );
            },
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    ref.listen<AsyncValue>(authNotifierProvider, (_, state) {
      if (!state.isLoading && state.hasError) {
        AppDialogs.showErrorDialog(
          context,
          message: _extractFirebaseErrorMessage(state.error),
        );
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
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // Ambient Orbs Decoration
          Positioned(
            top: -50,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF9CF2E8).withValues(alpha: 0.3),
              ),
            ),
          ),
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 50, sigmaY: 50),
              child: const SizedBox(),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 24,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Liên kết số điện thoại',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0B1C30),
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Để đảm bảo chuyên viên có thể liên lạc với bạn khi đặt dịch vụ, vui lòng cung cấp số điện thoại để liên kết với tài khoản này.',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 15,
                        height: 1.5,
                        color: Color(0xFF4B5563),
                      ),
                    ),
                    const SizedBox(height: 40),

                    PhoneInputField(
                      onPhoneChanged: (phone) {
                        setState(() {
                          _phone = phone;
                        });
                      },
                    ),
                    const SizedBox(height: 32),

                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _phone.length >= 9 && !authState.isLoading
                            ? _handleLinkPhone
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
                          shadowColor: const Color(0xFF0F766E)
                              .withValues(alpha: 0.35),
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
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  Text(
                                    'Gửi mã xác minh',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward, size: 20),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
