import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../di/invitations_providers.dart';
import '../../domain/entities/received_invitation_entity.dart';

class InvitationDetailScreen extends ConsumerStatefulWidget {
  final String invitationId;
  final ReceivedInvitationEntity? initialInvitation;

  const InvitationDetailScreen({
    super.key,
    required this.invitationId,
    this.initialInvitation,
  });

  @override
  ConsumerState<InvitationDetailScreen> createState() =>
      _InvitationDetailScreenState();
}

class _InvitationDetailScreenState
    extends ConsumerState<InvitationDetailScreen> {
  final _tokenCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final alreadyLoaded = ref.exists(myInvitationsNotifierProvider);
    Future.microtask(() {
      if (mounted && alreadyLoaded) {
        ref.read(myInvitationsNotifierProvider.notifier).loadInvitations();
      }
    });
  }

  @override
  void dispose() {
    _tokenCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleAccept() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    final token = _tokenCtrl.text.trim();
    final notifier = ref.read(myInvitationsNotifierProvider.notifier);
    final success = await notifier.accept(widget.invitationId, token);

    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
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
              'Gia nhập thành công!\n\nBạn đã là thành viên của cơ sở. Tiếp tục hoàn thiện hồ sơ chuyên môn (KYC) để sẵn sàng nhận đơn.',
              textAlign: TextAlign.center,
              style: TextStyle(height: 1.4, fontSize: 15),
            ),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.go('/home');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 48),
                ),
                child: const Text('Về trang chủ'),
              ),
            ],
          ),
        );
      } else {
        AppDialog.showErrorDialog(
          context,
          message: 'Mã xác nhận không đúng hoặc lời mời đã hết hạn / tài khoản đang có ràng buộc khác.',
        );
      }
    }
  }

  Future<void> _handleDecline() async {
    if (!_formKey.currentState!.validate()) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Từ chối lời mời?'),
        content: const Text(
          'Bạn sẽ không tham gia vào cơ sở này. Thao tác này không thể hoàn tác.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
            ),
            child: const Text('Từ chối'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      setState(() => _isLoading = true);
      final token = _tokenCtrl.text.trim();
      final notifier = ref.read(myInvitationsNotifierProvider.notifier);
      final success = await notifier.decline(widget.invitationId, token);
      if (mounted) {
        setState(() => _isLoading = false);
        if (success) {
          context.pop();
        } else {
          AppDialog.showErrorDialog(
            context,
            message: 'Không thể từ chối lời mời. Vui lòng kiểm tra lại mã.',
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(myInvitationsNotifierProvider);
    final matches = state.valueOrNull?.where(
      (inv) => inv.id == widget.invitationId,
    );
    final invitation = matches?.isNotEmpty == true ? matches!.first : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Chi tiết lời mời',
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
      body: invitation == null
          ? Center(
              child: state.isLoading
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          state.hasError ? 'Chưa tải được lời mời.' : 'Không tìm thấy lời mời trong danh sách hiện tại.',
                        ),
                        TextButton(
                          onPressed: () => ref
                              .read(myInvitationsNotifierProvider.notifier)
                              .loadInvitations(),
                          child: const Text('Tải lại danh sách'),
                        ),
                      ],
                    ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Organization Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              color: AppColors.surfaceContainerHigh,
                              image:
                                  invitation.providerAvatarUrl != null &&
                                      invitation.providerAvatarUrl!.isNotEmpty
                                  ? DecorationImage(
                                      image: NetworkImage(
                                        invitation.providerAvatarUrl!,
                                      ),
                                      fit: BoxFit.cover,
                                    )
                                  : null,
                            ),
                            child:
                                invitation.providerAvatarUrl == null ||
                                    invitation.providerAvatarUrl!.isEmpty
                                ? const Icon(
                                    Icons.storefront_rounded,
                                    size: 36,
                                    color: AppColors.primary,
                                  )
                                : null,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            invitation.providerDisplayName,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0B1C30),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            invitation.providerServiceAreaName != null &&
                                    invitation
                                        .providerServiceAreaName!
                                        .isNotEmpty
                                ? invitation.providerServiceAreaName!
                                : 'Đối tác Lambe',
                            style: const TextStyle(
                              fontSize: 14,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'Hạn xác nhận: ${DateFormat('dd/MM/yyyy HH:mm').format(invitation.expiresAt)}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF475569),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    if (invitation.isPending && !invitation.isExpired) ...[
                      // Token Input
                      const Text(
                        'Nhập mã xác nhận lời mời',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Chủ cơ sở đã cung cấp cho bạn một chuỗi mã bảo mật để xác thực danh tính.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _tokenCtrl,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: 'Dán mã xác nhận 32 ký tự vào đây...',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                        ),
                        validator: (v) {
                          if (v == null || v.trim().length < 16) {
                            return 'Vui lòng nhập đầy đủ mã xác nhận lời mời.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 32),

                      // Actions
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleAccept,
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
                                'Đồng ý gia nhập cơ sở',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: _isLoading ? null : _handleDecline,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                          side: const BorderSide(color: Color(0xFFDC2626)),
                          minimumSize: const Size(double.infinity, 52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text('Từ chối lời mời'),
                      ),
                    ] else ...[
                      Center(
                        child: Text(
                          invitation.isAccepted
                              ? 'Bạn đã chấp nhận lời mời này.'
                              : 'Lời mời này đã kết thúc.',
                          style: const TextStyle(
                            fontSize: 15,
                            color: Color(0xFF6B7280),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}
