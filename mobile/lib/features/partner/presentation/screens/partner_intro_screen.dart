import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../di/partner_providers.dart';
import '../utils/partner_resume_utils.dart';

class PartnerIntroScreen extends ConsumerStatefulWidget {
  const PartnerIntroScreen({super.key});

  @override
  ConsumerState<PartnerIntroScreen> createState() => _PartnerIntroScreenState();
}

class _PartnerIntroScreenState extends ConsumerState<PartnerIntroScreen> {
  bool _isResolvingEntry = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _checkRegistration(proceedWhenNoApplication: false),
    );
  }

  Future<void> _checkRegistration({
    required bool proceedWhenNoApplication,
  }) async {
    final notifier = ref.read(partnerNotifierProvider.notifier);
    final application = await notifier.loadLatestApplication();
    if (!mounted) return;

    final error = ref.read(partnerNotifierProvider).error;
    if (error != null) {
      _revealIntro();
      AppDialogs.showErrorDialog(context, message: error.toString());
      return;
    }
    if (application == null) {
      _revealIntro();
      if (proceedWhenNoApplication) context.push('/partner/type');
      return;
    }
    if (!application.isEditable) {
      context.replace('/partner/status');
      return;
    }

    _revealIntro();
    final shouldResume = await showPartnerResumeDialog(context);
    if (shouldResume && mounted) {
      context.push(partnerRouteForStep(application.resumeStep));
    }
  }

  void _revealIntro() {
    if (_isResolvingEntry && mounted) {
      setState(() => _isResolvingEntry = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(partnerNotifierProvider).isLoading;
    if (_isResolvingEntry) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8F9FF),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
      );
    }

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
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F766E).withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.handshake_rounded,
                          size: 60,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'Trở thành đối tác Lambe',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0B1C30),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Kiếm thêm thu nhập và chủ động thời gian bằng cách cung cấp dịch vụ làm đẹp tại nhà cho hàng ngàn khách hàng trên Lambe.',
                        style: TextStyle(
                          fontSize: 16,
                          color: Color(0xFF4B5563),
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 48),
                      _buildFeatureItem(
                        Icons.schedule,
                        'Thời gian linh hoạt',
                        'Tự do chọn thời gian làm việc phù hợp với bạn',
                      ),
                      const SizedBox(height: 24),
                      _buildFeatureItem(
                        Icons.attach_money,
                        'Thu nhập hấp dẫn',
                        'Nhận 100% tiền tip và mức chiết khấu cạnh tranh',
                      ),
                      const SizedBox(height: 24),
                      _buildFeatureItem(
                        Icons.support_agent,
                        'Hỗ trợ 24/7',
                        'Đội ngũ Lambe luôn đồng hành cùng bạn',
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              ElevatedButton(
                onPressed: isLoading
                    ? null
                    : () => _checkRegistration(proceedWhenNoApplication: true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                  elevation: 0,
                ),
                child: isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Bắt đầu ngay',
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
    );
  }

  Widget _buildFeatureItem(IconData icon, String title, String description) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(icon, color: const Color(0xFF0F766E), size: 24),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Color(0xFF0B1C30),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
