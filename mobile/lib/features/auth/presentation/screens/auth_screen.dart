import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../di/auth_providers.dart';
import '../../domain/exceptions/auth_flow_exception.dart';
import '../widgets/phone_input_field.dart';
import '../widgets/social_login_button.dart';
import '../widgets/terms_disclaimer.dart';

import 'package:mobile/core/utils/app_dialogs.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
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
    return 'Có lỗi xảy ra, vui lòng thử lại: ${errStr.split("]").last.trim()}';
  }

  void _handlePhoneLogin() {
    if (_phone.length >= 9) {
      ref
          .read(authNotifierProvider.notifier)
          .sendOtp(
            _phone,
            onCodeSent: () {
              context.push('/auth/otp', extra: _phone);
            },
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    ref.listen<AsyncValue>(authNotifierProvider, (_, state) {
      if (!state.isLoading && state.hasError) {
        final error = state.error;
        if (error is RegistrationRequiredException) {
          context.push(
            '/auth/complete-registration',
            extra: error.registrationToken,
          );
        } else if (error is PhoneVerificationRequiredException) {
          context.push('/auth/link-phone');
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
      body: SafeArea(
        child: Stack(
          children: [
            // Ambient Orbs Decoration
            Positioned(
              top: -50,
              left: MediaQuery.of(context).size.width / 2 - 150,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF9CF2E8).withValues(alpha: 0.3),
                ),
              ),
            ),
            Positioned(
              top: 150,
              right: -50,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFFDBC8).withValues(alpha: 0.3),
                ),
              ),
            ),
            // Áp dụng bộ lọc mờ cho background
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 50, sigmaY: 50),
                child: const SizedBox(),
              ),
            ),

            Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 24,
                    ),
                    child: Column(
                      children: [
                        const SizedBox(height: 20),
                        // Logo
                        SvgPicture.asset(
                          'assets/images/logo.svg',
                          height: 96,
                          width: 96,
                          fit: BoxFit.contain,
                        ),
                        const SizedBox(height: 24),

                        // Heading & Subtitle
                        const Text(
                          'Chào mừng bạn đến với Lambe',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B1C30),
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Đăng nhập để trải nghiệm dịch vụ chăm sóc sắc đẹp cao cấp tại nhà',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 14,
                            color: Color(0xFF3E4947),
                          ),
                        ),
                        const SizedBox(height: 32),

                        // Phone Input Field
                        PhoneInputField(
                          onPhoneChanged: (phone) {
                            setState(() {
                              _phone = phone;
                            });
                          },
                        ),
                        const SizedBox(height: 24),

                        // Primary CTA Button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed:
                                _phone.length >= 9 && !authState.isLoading
                                ? _handlePhoneLogin
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
                                        'Xác nhận',
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
                        const SizedBox(height: 28),

                        // Divider
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                height: 1,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      const Color(0xFFBDC9C6)
                                          .withValues(alpha: 0),
                                      const Color(0xFFBDC9C6)
                                          .withValues(alpha: 0.6),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'HOẶC TIẾP TỤC VỚI',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF6E7977),
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Container(
                                height: 1,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      const Color(0xFFBDC9C6)
                                          .withValues(alpha: 0.6),
                                      const Color(0xFFBDC9C6)
                                          .withValues(alpha: 0),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Social Login Buttons
                        SocialLoginButton(
                          text: 'Tiếp tục với Google',
                          iconWidget: SvgPicture.string(
                            '''<svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"></path></svg>''',
                            width: 24,
                            height: 24,
                          ),
                          onPressed: () {
                            ref
                                .read(authNotifierProvider.notifier)
                                .loginWithGoogle();
                          },
                        ),
                        SocialLoginButton(
                          text: 'Tiếp tục với Facebook',
                          iconWidget: SvgPicture.string(
                            '''<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"></path></svg>''',
                            width: 24,
                            height: 24,
                          ),
                          onPressed: () {
                            ref
                                .read(authNotifierProvider.notifier)
                                .loginWithFacebook();
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                // Footer
                const Padding(
                  padding: EdgeInsets.only(bottom: 24),
                  child: TermsDisclaimer(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
