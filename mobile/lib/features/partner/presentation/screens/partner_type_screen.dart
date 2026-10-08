import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/app_failure.dart';
import '../../../../core/utils/app_dialogs.dart';
import '../../di/partner_providers.dart';
import '../utils/partner_resume_utils.dart';
import '../widgets/partner_registration_progress.dart';

class PartnerTypeScreen extends ConsumerStatefulWidget {
  const PartnerTypeScreen({super.key});

  @override
  ConsumerState<PartnerTypeScreen> createState() => _PartnerTypeScreenState();
}

class _PartnerTypeScreenState extends ConsumerState<PartnerTypeScreen> {
  String? _selectedType; // 'INDIVIDUAL' or 'ORGANIZATION'

  Future<void> _submit() async {
    if (_selectedType == null) {
      AppDialogs.showErrorDialog(
        context,
        message: 'Vui lòng chọn loại hình hoạt động của bạn.',
      );
      return;
    }

    final notifier = ref.read(partnerNotifierProvider.notifier);
    final success = await notifier.createApplication(_selectedType!);
    if (success && mounted) {
      context.push('/partner/info');
      return;
    }
    if (!mounted) return;

    final error = ref.read(partnerNotifierProvider).error;
    if (error is AppFailure && error.statusCode == 409) {
      final application = await notifier.loadLatestApplication();
      if (!mounted) return;
      if (application != null && application.isEditable) {
        final shouldResume = await showPartnerResumeDialog(context);
        if (shouldResume && mounted) {
          context.push(partnerRouteForStep(application.resumeStep));
        }
        return;
      }
      if (application != null && !application.isEditable) {
        context.push('/partner/status');
        return;
      }
    }
    if (mounted) {
      AppDialogs.showErrorDialog(
        context,
        message: error?.toString() ?? 'Không thể tạo hồ sơ đăng ký.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Loại hình đối tác',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const PartnerRegistrationProgress(
              currentStep: PartnerRegistrationStep.type,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Bạn cung cấp dịch vụ dưới hình thức nào?',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0B1C30),
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Hãy chọn loại hình phù hợp nhất để chúng tôi tối ưu hồ sơ và quyền lợi cho bạn.',
                      style: TextStyle(
                        fontSize: 15,
                        color: Color(0xFF6B7280),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 40),

                    _buildTypeCard(
                      type: 'INDIVIDUAL',
                      title: 'Cá nhân tự do',
                      description: 'Dành cho thợ trang điểm, thợ cắt tóc cá nhân cung cấp dịch vụ độc lập.',
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 20),
                    _buildTypeCard(
                      type: 'ORGANIZATION',
                      title: 'Tổ chức / Salon / Studio',
                      description: 'Dành cho tiệm làm đẹp, salon có giấy phép đăng ký kinh doanh và có thợ nhân viên.',
                      icon: Icons.storefront_outlined,
                    ),

                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: state.isLoading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(100),
                        ),
                        elevation: 0,
                        disabledBackgroundColor: const Color(0xFFE5E7EB),
                      ),
                      child: state.isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Text(
                              'Tiếp tục',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeCard({
    required String type,
    required String title,
    required String description,
    required IconData icon,
  }) {
    final isSelected = _selectedType == type;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedType = type;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF0F766E).withValues(alpha: 0.05)
              : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF0F766E)
                : const Color(0xFFE5E7EB),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF0F766E)
                    : const Color(0xFFF3F4F6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isSelected ? Colors.white : const Color(0xFF6B7280),
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      color: isSelected
                          ? const Color(0xFF0F766E)
                          : const Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF6B7280),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(
                Icons.check_circle,
                color: Color(0xFF0F766E),
                size: 24,
              ),
          ],
        ),
      ),
    );
  }
}
