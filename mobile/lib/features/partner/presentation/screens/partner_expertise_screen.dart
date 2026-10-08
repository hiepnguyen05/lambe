import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/domain/value_objects/upload_payload.dart';
import '../../../../core/utils/app_dialogs.dart';
import '../../di/partner_providers.dart';
import '../widgets/partner_document_upload_box.dart';
import '../widgets/partner_registration_progress.dart';

class PartnerExpertiseScreen extends ConsumerStatefulWidget {
  const PartnerExpertiseScreen({super.key});

  @override
  ConsumerState<PartnerExpertiseScreen> createState() =>
      _PartnerExpertiseScreenState();
}

class _PartnerExpertiseScreenState
    extends ConsumerState<PartnerExpertiseScreen> {
  File? _certificate;
  final List<File> _portfolioFiles = [];

  Future<void> _pickCertificate() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (picked == null || !mounted) return;
    setState(() => _certificate = File(picked.path));
  }

  Future<void> _pickPortfolio() async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 88);
    if (picked.isEmpty || !mounted) return;
    setState(() {
      final existingPaths = _portfolioFiles.map((file) => file.path).toSet();
      _portfolioFiles.addAll(
        picked
            .where((image) => !existingPaths.contains(image.path))
            .map((image) => File(image.path)),
      );
    });
  }

  Future<bool> _upload(String type, File file) {
    return file.readAsBytes().then(
      (bytes) => ref
          .read(partnerNotifierProvider.notifier)
          .uploadDocument(
            type,
            UploadPayload(bytes: bytes, fileName: file.uri.pathSegments.last),
          ),
    );
  }

  Future<void> _submit() async {
    final application = ref.read(partnerNotifierProvider).valueOrNull;
    if (application == null) return;
    final certificateCount =
        application.certificateDocumentCount + (_certificate == null ? 0 : 1);
    final portfolioCount =
        application.portfolioDocumentCount + _portfolioFiles.length;

    if (application.requiresProfessionalCertificate && certificateCount < 1) {
      AppDialogs.showErrorDialog(
        context,
        message: 'Các dịch vụ đã chọn yêu cầu ít nhất một chứng chỉ nghề.',
      );
      return;
    }
    if (portfolioCount < application.requiredPortfolioImages) {
      AppDialogs.showErrorDialog(
        context,
        message:
            'Bạn cần tải đủ ${application.requiredPortfolioImages} ảnh sản phẩm. Hiện có $portfolioCount ảnh.',
      );
      return;
    }

    if (_certificate != null &&
        !await _upload('PROFESSIONAL_CERTIFICATE', _certificate!)) {
      if (mounted) _showUploadError();
      return;
    }
    for (final file in _portfolioFiles) {
      if (!await _upload('PORTFOLIO', file)) {
        if (mounted) _showUploadError();
        return;
      }
    }
    if (mounted) context.push('/partner/submit');
  }

  void _showUploadError() {
    final error = ref.read(partnerNotifierProvider).error;
    AppDialogs.showErrorDialog(
      context,
      message: error?.toString() ?? 'Không thể tải tài liệu năng lực.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);
    final application = state.valueOrNull;
    final requiredPortfolio = application?.requiredPortfolioImages ?? 0;
    final existingPortfolio = application?.portfolioDocumentCount ?? 0;
    final currentPortfolio = existingPortfolio + _portfolioFiles.length;
    final requiresCertificate =
        application?.requiresProfessionalCertificate ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Năng lực nghề nghiệp',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            const PartnerRegistrationProgress(
              currentStep: PartnerRegistrationStep.expertise,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Chứng minh tay nghề',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Yêu cầu được tính tự động từ các dịch vụ bạn đã đăng ký.',
                      style: TextStyle(color: Color(0xFF6B7280), height: 1.5),
                    ),
                    const SizedBox(height: 20),
                    _RequirementSummary(
                      requiresCertificate: requiresCertificate,
                      requiredPortfolio: requiredPortfolio,
                      currentPortfolio: currentPortfolio,
                    ),
                    if (application?.activeServiceRequirements.isNotEmpty ==
                        true) ...[
                      const SizedBox(height: 16),
                      ...application!.activeServiceRequirements.map(
                        (service) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.check_circle_outline,
                                size: 18,
                                color: Color(0xFF0F766E),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '${service.name}: ${service.requiresCertificate ? 'cần chứng chỉ' : 'không bắt buộc chứng chỉ'}, ${service.minPortfolioImages} ảnh sản phẩm.',
                                  style: const TextStyle(
                                    color: Color(0xFF4B5563),
                                    height: 1.4,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    PartnerDocumentUploadBox(
                      title: requiresCertificate
                          ? 'Chứng chỉ nghề *'
                          : 'Chứng chỉ nghề (không bắt buộc)',
                      file: _certificate,
                      isUploaded:
                          (application?.certificateDocumentCount ?? 0) > 0,
                      onTap: _pickCertificate,
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Ảnh sản phẩm đã thực hiện',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0B1C30),
                            ),
                          ),
                        ),
                        Text(
                          '$currentPortfolio/$requiredPortfolio ảnh',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: currentPortfolio >= requiredPortfolio
                                ? const Color(0xFF0F766E)
                                : const Color(0xFFDC2626),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _pickPortfolio,
                      icon: const Icon(Icons.add_photo_alternate_outlined),
                      label: Text(
                        requiredPortfolio > 0
                            ? 'Chọn nhiều ảnh sản phẩm'
                            : 'Thêm ảnh sản phẩm',
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 52),
                        foregroundColor: const Color(0xFF0F766E),
                        side: const BorderSide(color: Color(0xFF99D5CF)),
                      ),
                    ),
                    if (existingPortfolio > 0) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Đã có $existingPortfolio ảnh được tải lên trước đó.',
                        style: const TextStyle(
                          color: Color(0xFF0F766E),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    if (_portfolioFiles.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _portfolioFiles.length,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                            ),
                        itemBuilder: (context, index) {
                          final file = _portfolioFiles[index];
                          return Stack(
                            fit: StackFit.expand,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.file(file, fit: BoxFit.cover),
                              ),
                              Positioned(
                                right: 4,
                                top: 4,
                                child: IconButton.filled(
                                  tooltip: 'Bỏ ảnh',
                                  onPressed: () => setState(
                                    () => _portfolioFiles.removeAt(index),
                                  ),
                                  icon: const Icon(Icons.close, size: 16),
                                  style: IconButton.styleFrom(
                                    backgroundColor: Colors.black54,
                                    foregroundColor: Colors.white,
                                    minimumSize: const Size(30, 30),
                                    padding: EdgeInsets.zero,
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(24),
              color: Colors.white,
              child: FilledButton(
                onPressed: state.isLoading ? null : _submit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 56),
                  backgroundColor: const Color(0xFF0F766E),
                ),
                child: state.isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Tiếp tục',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RequirementSummary extends StatelessWidget {
  final bool requiresCertificate;
  final int requiredPortfolio;
  final int currentPortfolio;

  const _RequirementSummary({
    required this.requiresCertificate,
    required this.requiredPortfolio,
    required this.currentPortfolio,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDFA),
        border: Border.all(color: const Color(0xFF99D5CF)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Yêu cầu tối thiểu',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              color: Color(0xFF115E59),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            requiresCertificate
                ? '• Ít nhất 1 chứng chỉ nghề đã xác minh'
                : '• Không bắt buộc chứng chỉ nghề',
            style: const TextStyle(color: Color(0xFF134E4A), height: 1.5),
          ),
          Text(
            requiredPortfolio > 0
                ? '• $requiredPortfolio ảnh sản phẩm ($currentPortfolio ảnh hiện có)'
                : '• Không bắt buộc ảnh sản phẩm',
            style: const TextStyle(color: Color(0xFF134E4A), height: 1.5),
          ),
        ],
      ),
    );
  }
}
