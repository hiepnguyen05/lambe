import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_typography.dart';
import '../providers/auth_provider.dart';
import '../widgets/auth_app_bar.dart';
import '../widgets/brand_showcase.dart';
import '../widgets/complete_registration_card.dart';
import '../widgets/otp_input_card.dart';
import '../widgets/phone_input_card.dart';
import '../widgets/social_divider.dart';
import '../widgets/social_login_buttons.dart';
import '../widgets/terms_disclaimer.dart';

class CustomerAuthScreen extends ConsumerStatefulWidget {
  final VoidCallback? onAuthSuccess;

  const CustomerAuthScreen({
    super.key,
    this.onAuthSuccess,
  });

  @override
  ConsumerState<CustomerAuthScreen> createState() => _CustomerAuthScreenState();
}

class _CustomerAuthScreenState extends ConsumerState<CustomerAuthScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _fullNameController = TextEditingController();

  final _phoneFormKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();
  final _profileFormKey = GlobalKey<FormState>();

  bool _isPhoneValid = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _fullNameController.dispose();
    super.dispose();
  }

  void _onPhoneChanged(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    final isValid = digits.length >= 10 && digits.length <= 11;
    if (_isPhoneValid != isValid) {
      setState(() => _isPhoneValid = isValid);
    }
  }

  void _onSendOtp() async {
    if (!(_phoneFormKey.currentState?.validate() ?? false)) return;

    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    final success = await ref.read(authNotifierProvider.notifier).sendOtp(phone);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mã OTP đã được gửi đến số điện thoại của bạn.')),
      );
    }
  }

  void _onVerifyOtp() async {
    if (!(_otpFormKey.currentState?.validate() ?? false)) return;

    final code = _otpController.text.trim();
    final success = await ref.read(authNotifierProvider.notifier).verifyOtp(code);

    if (success && mounted) {
      final authState = ref.read(authNotifierProvider);
      if (authState.isAuthenticated) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Đăng nhập thành công. Chào mừng ${authState.user?.fullName ?? ''}!')),
        );
        widget.onAuthSuccess?.call();
      }
    }
  }

  void _onCompleteRegistration() async {
    if (!(_profileFormKey.currentState?.validate() ?? false)) return;

    final fullName = _fullNameController.text.trim();
    final success = await ref.read(authNotifierProvider.notifier).completeRegistration(fullName);

    if (success && mounted) {
      final authState = ref.read(authNotifierProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đăng ký thành công! Chào mừng ${authState.user?.fullName ?? ''}.')),
      );
      widget.onAuthSuccess?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AuthAppBar(title: 'Đăng nhập'), // Không có nút back ở header
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
          child: Column(
            children: [
              // 1. Brand Showcase & Intro Header
              const BrandShowcase(
                title: 'Chào mừng bạn đến với Lambe',
                subtitle: 'Nhập số điện thoại để tiếp tục',
              ),
              const SizedBox(height: 24),

              // Error Toast / Notification
              if (authState.errorMessage != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.errorContainer,
                    borderRadius: AppRadii.borderDefault,
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          authState.errorMessage!,
                          style: AppTypography.bodyMd.copyWith(color: AppColors.onErrorContainer),
                        ),
                      ),
                    ],
                  ),
                ),

              // 2. Dynamic Input Card based on Auth Step
              switch (authState.step) {
                AuthStep.enterPhone => PhoneInputCard(
                    controller: _phoneController,
                    formKey: _phoneFormKey,
                    isLoading: authState.isLoading,
                    isPhoneValid: _isPhoneValid,
                    onChanged: _onPhoneChanged,
                    onSubmit: _onSendOtp,
                  ),
                AuthStep.enterOtp => OtpInputCard(
                    controller: _otpController,
                    formKey: _otpFormKey,
                    phone: authState.phone,
                    isLoading: authState.isLoading,
                    onVerify: _onVerifyOtp,
                    onResend: _onSendOtp,
                    onChangePhone: () {
                      ref.read(authNotifierProvider.notifier).resetToPhoneStep();
                    },
                  ),
                AuthStep.completeRegistration => CompleteRegistrationCard(
                    controller: _fullNameController,
                    formKey: _profileFormKey,
                    isLoading: authState.isLoading,
                    onSubmit: _onCompleteRegistration,
                  ),
              },

              // 3. Social Authentication Divider
              const SocialDivider(label: 'HOẶC TIẾP TỤC VỚI'),

              // 4. Quick Social Auth Buttons
              SocialLoginButtons(
                onGoogleTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Tính năng đăng nhập Google đang được phát triển.')),
                  );
                },
                onFacebookTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Tính năng đăng nhập Facebook đang được phát triển.')),
                  );
                },
              ),

              // 5. Terms & Privacy Policy Disclaimer
              TermsDisclaimer(
                onTermsTap: () {},
                onPrivacyTap: () {},
              ),
            ],
          ),
        ),
      ),
    );
  }
}
