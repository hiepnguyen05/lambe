import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../di/partner_providers.dart';
import '../widgets/partner_registration_progress.dart';

class PartnerSubmitScreen extends ConsumerStatefulWidget {
  const PartnerSubmitScreen({super.key});

  @override
  ConsumerState<PartnerSubmitScreen> createState() =>
      _PartnerSubmitScreenState();
}

class _PartnerSubmitScreenState extends ConsumerState<PartnerSubmitScreen> {
  bool _isAccepted = false;

  Future<void> _submit() async {
    if (!_isAccepted) {
      AppDialogs.showErrorDialog(
        context,
        message: 'Bạn cần đồng ý với các điều khoản của Lambe để tiếp tục.',
      );
      return;
    }

    final success = await ref
        .read(partnerNotifierProvider.notifier)
        .submitApplication();

    if (success && mounted) {
      // Chuyển sang màn hình thành công hoặc trang chủ tuỳ luồng
      final destination = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Icon(
            Icons.check_circle,
            color: Color(0xFF0F766E),
            size: 64,
          ),
          content: const Text(
            'Gửi hồ sơ thành công!\n\nChúng tôi sẽ xét duyệt hồ sơ của bạn và phản hồi trong thời gian sớm nhất.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop('/home'),
              child: const Text('Về trang chủ'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop('/partner/status'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: const Text('Xem trạng thái'),
            ),
          ],
        ),
      );

      if (mounted && destination != null) {
        context.go(destination);
      }
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
          'Hoàn tất',
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
              currentStep: PartnerRegistrationStep.submit,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Xác nhận điều khoản',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      height: 300,
                      child: const SingleChildScrollView(
                        child: Text(
                          '''Bằng việc nhấn "Đồng ý và Gửi hồ sơ", bạn cam kết:
                          
1. Mọi thông tin, tài liệu cung cấp là chính xác và hợp pháp.
2. Bạn có đủ năng lực hành vi dân sự và chuyên môn để cung cấp các dịch vụ đã đăng ký.
3. Lambe có quyền sử dụng thông tin hồ sơ của bạn để thực hiện xác minh và hiển thị trên nền tảng sau khi được duyệt.
4. Tuân thủ các quy tắc ứng xử, đạo đức nghề nghiệp và chính sách chất lượng dịch vụ của nền tảng Lambe.
5. Lambe có quyền từ chối hồ sơ nếu phát hiện thông tin gian lận.

Hãy đảm bảo bạn đã đọc kỹ trước khi gửi.''',
                          style: TextStyle(
                            height: 1.5,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    CheckboxListTile(
                      value: _isAccepted,
                      activeColor: const Color(0xFF0F766E),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Tôi đã đọc, hiểu và đồng ý với các Điều khoản & Thỏa thuận đối tác của Lambe.',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      onChanged: (val) {
                        setState(() {
                          _isAccepted = val ?? false;
                        });
                      },
                    ),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(24.0),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: state.isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
                child: state.isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Đồng ý và Gửi hồ sơ',
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
    );
  }
}
