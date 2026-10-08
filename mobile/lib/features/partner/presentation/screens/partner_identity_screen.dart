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

class PartnerIdentityScreen extends ConsumerStatefulWidget {
  const PartnerIdentityScreen({super.key});

  @override
  ConsumerState<PartnerIdentityScreen> createState() =>
      _PartnerIdentityScreenState();
}

class _PartnerIdentityScreenState extends ConsumerState<PartnerIdentityScreen> {
  File? _portrait;
  File? _selfie;
  File? _idFront;
  File? _idBack;
  File? _businessLicense;

  bool _hasExistingDocument(String type) =>
      ref
          .read(partnerNotifierProvider)
          .valueOrNull
          ?.documentTypes
          .contains(type) ==
      true;

  bool _hasDocument(String type, File? file) =>
      file != null || _hasExistingDocument(type);

  Future<void> _pickImage(String type) async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (picked == null || !mounted) return;
    setState(() {
      final file = File(picked.path);
      switch (type) {
        case 'PORTRAIT':
          _portrait = file;
        case 'IDENTITY_SELFIE':
          _selfie = file;
        case 'ID_CARD_FRONT':
          _idFront = file;
        case 'ID_CARD_BACK':
          _idBack = file;
        case 'BUSINESS_LICENSE':
          _businessLicense = file;
      }
    });
  }

  Future<bool> _upload(String type, File? file) async {
    if (file == null) return true;
    return ref
        .read(partnerNotifierProvider.notifier)
        .uploadDocument(
          type,
          UploadPayload(
            bytes: await file.readAsBytes(),
            fileName: file.uri.pathSegments.last,
          ),
        );
  }

  Future<void> _submit() async {
    final application = ref.read(partnerNotifierProvider).valueOrNull;
    if (application == null) return;
    final isOrganization = application.providerType == 'ORGANIZATION';

    if (!_hasDocument('PORTRAIT', _portrait)) {
      AppDialogs.showErrorDialog(
        context,
        message: isOrganization
            ? 'Vui lòng tải ảnh đại diện của tổ chức.'
            : 'Vui lòng tải ảnh chân dung của bạn.',
      );
      return;
    }
    if (isOrganization) {
      if (!_hasDocument('BUSINESS_LICENSE', _businessLicense)) {
        AppDialogs.showErrorDialog(
          context,
          message: 'Vui lòng tải giấy đăng ký kinh doanh.',
        );
        return;
      }
    } else if (!_hasDocument('ID_CARD_FRONT', _idFront) ||
        !_hasDocument('ID_CARD_BACK', _idBack) ||
        !_hasDocument('IDENTITY_SELFIE', _selfie)) {
      AppDialogs.showErrorDialog(
        context,
        message: 'Vui lòng cung cấp đủ hai mặt CCCD và ảnh selfie cầm CCCD.',
      );
      return;
    }

    final uploads = <(String, File?)>[
      ('PORTRAIT', _portrait),
      if (isOrganization)
        ('BUSINESS_LICENSE', _businessLicense)
      else ...[
        ('ID_CARD_FRONT', _idFront),
        ('ID_CARD_BACK', _idBack),
        ('IDENTITY_SELFIE', _selfie),
      ],
    ];
    for (final upload in uploads) {
      if (!await _upload(upload.$1, upload.$2)) {
        if (!mounted) return;
        final error = ref.read(partnerNotifierProvider).error;
        AppDialogs.showErrorDialog(
          context,
          message: error?.toString() ?? 'Không thể tải giấy tờ xác minh.',
        );
        return;
      }
    }
    if (mounted) context.push('/partner/expertise');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(partnerNotifierProvider);
    final application = state.valueOrNull;
    final isOrganization = application?.providerType == 'ORGANIZATION';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Xác minh danh tính',
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
              currentStep: PartnerRegistrationStep.identity,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Thông tin định danh',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Ảnh và giấy tờ chỉ được dùng để xác minh hồ sơ và được lưu trữ bảo mật.',
                      style: TextStyle(color: Color(0xFF6B7280), height: 1.5),
                    ),
                    const SizedBox(height: 24),
                    _PortraitPicker(
                      file: _portrait,
                      isUploaded: _hasExistingDocument('PORTRAIT'),
                      label: isOrganization
                          ? 'Ảnh đại diện tổ chức *'
                          : 'Ảnh chân dung *',
                      onTap: () => _pickImage('PORTRAIT'),
                    ),
                    const SizedBox(height: 28),
                    if (isOrganization) ...[
                      PartnerDocumentUploadBox(
                        title: 'Giấy đăng ký kinh doanh *',
                        file: _businessLicense,
                        isUploaded: _hasExistingDocument('BUSINESS_LICENSE'),
                        onTap: () => _pickImage('BUSINESS_LICENSE'),
                      ),
                    ] else ...[
                      PartnerDocumentUploadBox(
                        title: 'CCCD mặt trước *',
                        file: _idFront,
                        isUploaded: _hasExistingDocument('ID_CARD_FRONT'),
                        onTap: () => _pickImage('ID_CARD_FRONT'),
                      ),
                      const SizedBox(height: 16),
                      PartnerDocumentUploadBox(
                        title: 'CCCD mặt sau *',
                        file: _idBack,
                        isUploaded: _hasExistingDocument('ID_CARD_BACK'),
                        onTap: () => _pickImage('ID_CARD_BACK'),
                      ),
                      const SizedBox(height: 16),
                      PartnerDocumentUploadBox(
                        title: 'Selfie cầm CCCD *',
                        file: _selfie,
                        isUploaded: _hasExistingDocument('IDENTITY_SELFIE'),
                        onTap: () => _pickImage('IDENTITY_SELFIE'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            _BottomAction(
              isLoading: state.isLoading,
              onPressed: _submit,
              label: 'Tiếp tục',
            ),
          ],
        ),
      ),
    );
  }
}

class _PortraitPicker extends StatelessWidget {
  final File? file;
  final bool isUploaded;
  final String label;
  final VoidCallback onTap;

  const _PortraitPicker({
    required this.file,
    required this.isUploaded,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onTap: onTap,
          child: Container(
            width: 148,
            height: 148,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              border: Border.all(color: const Color(0xFF0F766E), width: 2),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 16,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: ClipOval(
              child: file != null
                  ? Image.file(file!, fit: BoxFit.cover)
                  : ColoredBox(
                      color: const Color(0xFFF0FDFA),
                      child: Center(
                        child: Icon(
                          isUploaded
                              ? Icons.check_circle
                              : Icons.person_outline,
                          size: 56,
                          color: const Color(0xFF0F766E),
                        ),
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 4),
        TextButton.icon(
          onPressed: onTap,
          icon: const Icon(Icons.photo_library_outlined, size: 18),
          label: Text(
            isUploaded || file != null ? 'Chọn ảnh khác' : 'Chọn ảnh',
          ),
        ),
      ],
    );
  }
}

class _BottomAction extends StatelessWidget {
  final bool isLoading;
  final VoidCallback onPressed;
  final String label;

  const _BottomAction({
    required this.isLoading,
    required this.onPressed,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      color: Colors.white,
      child: FilledButton(
        onPressed: isLoading ? null : onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size(double.infinity, 56),
          backgroundColor: const Color(0xFF0F766E),
        ),
        child: isLoading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
