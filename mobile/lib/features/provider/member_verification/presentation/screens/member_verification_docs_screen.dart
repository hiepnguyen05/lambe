import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import '../../di/member_verification_providers.dart';

class MemberVerificationDocsScreen extends ConsumerStatefulWidget {
  final String memberId;

  const MemberVerificationDocsScreen({
    super.key,
    required this.memberId,
  });

  @override
  ConsumerState<MemberVerificationDocsScreen> createState() =>
      _MemberVerificationDocsScreenState();
}

class _MemberVerificationDocsScreenState
    extends ConsumerState<MemberVerificationDocsScreen> {
  File? _portrait;
  File? _idFront;
  File? _idBack;
  File? _selfie;
  bool _isUploading = false;

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
        case 'ID_CARD_FRONT':
          _idFront = file;
        case 'ID_CARD_BACK':
          _idBack = file;
        case 'IDENTITY_SELFIE':
          _selfie = file;
      }
    });
  }

  Future<void> _submitAll() async {
    final notifier =
        ref.read(memberVerificationNotifierProvider(widget.memberId).notifier);
    final profile =
        ref.read(memberVerificationNotifierProvider(widget.memberId)).valueOrNull;

    final existingDocs = profile?.documents ?? [];
    final hasPortrait =
        _portrait != null || existingDocs.any((d) => d.type == 'PORTRAIT');
    final hasFront =
        _idFront != null || existingDocs.any((d) => d.type == 'ID_CARD_FRONT');
    final hasBack =
        _idBack != null || existingDocs.any((d) => d.type == 'ID_CARD_BACK');
    final hasSelfie =
        _selfie != null || existingDocs.any((d) => d.type == 'IDENTITY_SELFIE');

    if (!hasPortrait || !hasFront || !hasBack || !hasSelfie) {
      AppDialog.showErrorDialog(
        context,
        message: 'Vui lòng tải đủ 4 giấy tờ định danh (Chân dung, 2 mặt CCCD, Selfie).',
      );
      return;
    }

    setState(() => _isUploading = true);

    // Upload pending local files
    final pendingUploads = <(String, File?)>[
      ('PORTRAIT', _portrait),
      ('ID_CARD_FRONT', _idFront),
      ('ID_CARD_BACK', _idBack),
      ('IDENTITY_SELFIE', _selfie),
    ];

    for (final item in pendingUploads) {
      if (item.$2 != null) {
        final bytes = await item.$2!.readAsBytes();
        final success = await notifier.uploadDocument(
          type: item.$1,
          bytes: bytes,
          fileName: item.$2!.uri.pathSegments.last,
        );
        if (!success && mounted) {
          setState(() => _isUploading = false);
          AppDialog.showErrorDialog(
            context,
            message: 'Tải ảnh ${item.$1} thất bại. Vui lòng thử lại.',
          );
          return;
        }
      }
    }

    // Submit KYC to PENDING_REVIEW
    final submitSuccess = await notifier.submit();
    if (mounted) {
      setState(() => _isUploading = false);
      if (submitSuccess) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: const Icon(
              Icons.check_circle_rounded,
              color: Color(0xFF0F766E),
              size: 56,
            ),
            content: const Text(
              'Gửi hồ sơ KYC thành công!\n\nKiểm duyệt viên sẽ xét duyệt giấy tờ của bạn. Bạn sẽ nhận được thông báo ngay khi có kết quả.',
              textAlign: TextAlign.center,
              style: TextStyle(height: 1.4, fontSize: 15),
            ),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.go(
                    '/provider/memberships/${widget.memberId}/verification/status',
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 48),
                ),
                child: const Text('Xem trạng thái duyệt'),
              ),
            ],
          ),
        );
      } else {
        AppDialog.showErrorDialog(
          context,
          message: 'Không thể nộp hồ sơ. Vui lòng kiểm tra lại tính đầy đủ của giấy tờ.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile =
        ref.watch(memberVerificationNotifierProvider(widget.memberId)).valueOrNull;
    final existingDocs = profile?.documents ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Giấy tờ & Chứng chỉ',
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Giấy tờ định danh bắt buộc',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0B1C30),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Ảnh chụp rõ nét, không bị mờ lóa, không mất góc.',
              style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 20),

            // 1. Chân dung
            _uploadTile(
              label: 'Ảnh chân dung',
              subtitle: 'Chụp chính diện, rõ khuôn mặt',
              file: _portrait,
              hasExisting: existingDocs.any((d) => d.type == 'PORTRAIT'),
              onTap: () => _pickImage('PORTRAIT'),
            ),
            const SizedBox(height: 14),

            // 2. Mặt trước CCCD
            _uploadTile(
              label: 'Mặt trước CCCD',
              subtitle: 'Chụp rõ họ tên, số thẻ và hình ảnh',
              file: _idFront,
              hasExisting: existingDocs.any((d) => d.type == 'ID_CARD_FRONT'),
              onTap: () => _pickImage('ID_CARD_FRONT'),
            ),
            const SizedBox(height: 14),

            // 3. Mặt sau CCCD
            _uploadTile(
              label: 'Mặt sau CCCD',
              subtitle: 'Chụp rõ chip và đặc điểm nhận dạng',
              file: _idBack,
              hasExisting: existingDocs.any((d) => d.type == 'ID_CARD_BACK'),
              onTap: () => _pickImage('ID_CARD_BACK'),
            ),
            const SizedBox(height: 14),

            // 4. Selfie cầm CCCD
            _uploadTile(
              label: 'Ảnh selfie cầm CCCD',
              subtitle: 'Cầm CCCD cạnh khuôn mặt để xác thực danh tính',
              file: _selfie,
              hasExisting: existingDocs.any((d) => d.type == 'IDENTITY_SELFIE'),
              onTap: () => _pickImage('IDENTITY_SELFIE'),
            ),

            const SizedBox(height: 36),
            ElevatedButton(
              onPressed: _isUploading ? null : _submitAll,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: _isUploading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Text(
                      'Hoàn tất & Nộp hồ sơ kiểm duyệt',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _uploadTile({
    required String label,
    required String subtitle,
    required File? file,
    required bool hasExisting,
    required VoidCallback onTap,
  }) {
    final isUploaded = file != null || hasExisting;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isUploaded ? const Color(0xFF0F766E) : const Color(0xFFE5E7EB),
          width: isUploaded ? 1.5 : 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isUploaded
                        ? const Color(0xFFE0F2FE)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isUploaded
                        ? Icons.check_circle_rounded
                        : Icons.camera_alt_outlined,
                    color: isUploaded
                        ? const Color(0xFF0F766E)
                        : const Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        file != null
                            ? 'Đã chọn ảnh mới'
                            : (hasExisting ? 'Đã tải lên' : subtitle),
                        style: TextStyle(
                          fontSize: 12,
                          color: isUploaded
                              ? const Color(0xFF0F766E)
                              : const Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 14,
                  color: Color(0xFF9CA3AF),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
