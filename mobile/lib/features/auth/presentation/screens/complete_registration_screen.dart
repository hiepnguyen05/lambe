import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/auth_providers.dart';

import 'package:mobile/core/utils/app_dialogs.dart';

class CompleteRegistrationScreen extends ConsumerStatefulWidget {
  final String registrationToken;

  const CompleteRegistrationScreen({
    super.key,
    required this.registrationToken,
  });

  @override
  ConsumerState<CompleteRegistrationScreen> createState() =>
      _CompleteRegistrationScreenState();
}

class _CompleteRegistrationScreenState
    extends ConsumerState<CompleteRegistrationScreen> {
  final TextEditingController _nameController = TextEditingController();

  void _submit() {
    final name = _nameController.text.trim();
    if (name.isNotEmpty) {
      ref
          .read(authNotifierProvider.notifier)
          .completeRegistration(widget.registrationToken, name);
    } else {
      AppDialogs.showErrorDialog(
        context,
        message: 'Vui lòng nhập họ và tên của bạn',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    ref.listen<AsyncValue>(authNotifierProvider, (_, state) {
      if (!state.isLoading && state.hasError) {
        AppDialogs.showErrorDialog(context, message: state.error.toString());
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
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Hoàn tất đăng ký',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Vui lòng nhập họ và tên của bạn để hoàn tất việc tạo tài khoản.',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF3E4947),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _nameController,
                decoration: InputDecoration(
                  hintText: 'Họ và tên',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 16,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: authState.isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                  ),
                  child: authState.isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Hoàn tất',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
