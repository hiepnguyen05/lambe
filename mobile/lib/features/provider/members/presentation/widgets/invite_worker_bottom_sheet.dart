import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../di/provider_members_providers.dart';
import '../../domain/entities/provider_member_invitation_entity.dart';

class InviteWorkerBottomSheet extends ConsumerStatefulWidget {
  const InviteWorkerBottomSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const InviteWorkerBottomSheet(),
    );
  }

  @override
  ConsumerState<InviteWorkerBottomSheet> createState() =>
      _InviteWorkerBottomSheetState();
}

class _InviteWorkerBottomSheetState
    extends ConsumerState<InviteWorkerBottomSheet> {
  final _phoneCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  ProviderMemberInvitationEntity? _createdInvitation;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    final rawPhone = _phoneCtrl.text.trim();
    final invitation = await ref
        .read(providerInvitationsNotifierProvider.notifier)
        .createInvitation(rawPhone);

    if (mounted) {
      setState(() {
        _isLoading = false;
        _createdInvitation = invitation;
      });
    }
  }

  void _copyInvitationMessage() {
    if (_createdInvitation == null || _createdInvitation!.token == null) return;
    final text =
        'Bạn nhận được lời mời tham gia đội ngũ Lambe. Mã xác nhận của bạn là: ${_createdInvitation!.token}\n\nHãy mở ứng dụng Lambe > Hồ sơ cá nhân > Lời mời gia nhập để chấp nhận.';
    Clipboard.setData(ClipboardData(text: text));
    AppDialog.success(
      context,
      message: 'Đã sao chép tin nhắn lời mời kèm mã xác nhận!',
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 24,
        left: 24,
        right: 24,
        bottom: bottomInset + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 300),
        child: _createdInvitation != null
            ? _buildSuccessView()
            : _buildInputView(),
      ),
    );
  }

  Widget _buildInputView() {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Mời thành viên mới',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0B1C30),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Color(0xFF6B7280)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Nhập số điện thoại thợ/nhân viên bạn muốn mời vào tổ chức. Họ sẽ nhận được mã bảo mật để xác nhận gia nhập.',
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFF4B5563),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: 'Số điện thoại nhân viên',
              hintText: '0912345678',
              prefixIcon: const Icon(
                Icons.phone_outlined,
                color: AppColors.primary,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              filled: true,
              fillColor: const Color(0xFFF8F9FF),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Vui lòng nhập số điện thoại.';
              }
              final clean = value.replaceAll(RegExp(r'[\s-]'), '');
              if (!RegExp(r'^(0|\+84)[3|5|7|8|9][0-9]{8}$').hasMatch(clean)) {
                return 'Số điện thoại không hợp lệ.';
              }
              return null;
            },
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _isLoading ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  )
                : const Text(
                    'Tạo lời mời & Lấy mã',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    final token = _createdInvitation?.token ?? '';

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(
          child: Icon(
            Icons.check_circle_rounded,
            color: Color(0xFF0F766E),
            size: 56,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Đã tạo lời mời thành công!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Gửi mã xác nhận bên dưới cho thợ (${_createdInvitation?.phone}). Mã này chỉ xuất hiện một lần duy nhất vì lý do an toàn.',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 14,
            color: Color(0xFF4B5563),
            height: 1.4,
          ),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  token,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                    color: Color(0xFF0F172A),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.copy_rounded, color: AppColors.primary),
                tooltip: 'Sao chép',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: token));
                  AppDialog.success(
                    context,
                    message: 'Đã sao chép mã xác nhận!',
                  );
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: _copyInvitationMessage,
          icon: const Icon(Icons.share_rounded),
          label: const Text('Sao chép tin nhắn gửi thợ'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Đóng'),
        ),
      ],
    );
  }
}
