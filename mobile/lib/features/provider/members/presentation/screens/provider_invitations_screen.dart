import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../di/provider_members_providers.dart';
import '../../domain/entities/provider_member_invitation_entity.dart';
import '../widgets/invite_worker_bottom_sheet.dart';

class ProviderInvitationsScreen extends ConsumerStatefulWidget {
  const ProviderInvitationsScreen({super.key});

  @override
  ConsumerState<ProviderInvitationsScreen> createState() =>
      _ProviderInvitationsScreenState();
}

class _ProviderInvitationsScreenState
    extends ConsumerState<ProviderInvitationsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(providerInvitationsNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Lời mời đã gửi',
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
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                'Lỗi khi tải danh sách: $err',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref
                    .read(providerInvitationsNotifierProvider.notifier)
                    .loadInvitations(),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (invitations) {
          if (invitations.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainer,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.mail_outline_rounded,
                      size: 48,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Chưa có lời mời nào được gửi',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Nhấn "+ Mời thợ" bên dưới để bắt đầu.',
                    style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref
                .read(providerInvitationsNotifierProvider.notifier)
                .loadInvitations(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: invitations.length,
              itemBuilder: (ctx, idx) {
                final item = invitations[idx];
                return _buildInvitationCard(item);
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Mời thêm thợ'),
        onPressed: () => InviteWorkerBottomSheet.show(context),
      ),
    );
  }

  Widget _buildInvitationCard(ProviderMemberInvitationEntity item) {
    Color statusColor;
    String statusText;

    if (item.isPending) {
      statusColor = const Color(0xFFD97706);
      statusText = 'Đang chờ';
    } else if (item.isAccepted) {
      statusColor = const Color(0xFF0F766E);
      statusText = 'Đã chấp nhận';
    } else if (item.isRevoked) {
      statusColor = const Color(0xFF6B7280);
      statusText = 'Đã thu hồi';
    } else if (item.isDeclined) {
      statusColor = const Color(0xFFDC2626);
      statusText = 'Đã từ chối';
    } else {
      statusColor = const Color(0xFFDC2626);
      statusText = 'Hết hạn';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.phone_android_rounded,
                    size: 20,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    item.phone,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  statusText,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text(
                'Gửi ngày: ${DateFormat('dd/MM/yyyy HH:mm').format(item.createdAt)}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              const Spacer(),
              Text(
                'Hết hạn: ${DateFormat('dd/MM/yyyy').format(item.expiresAt)}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
            ],
          ),
          if (item.token != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Mã: ${item.token}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: item.token!));
                      AppDialog.success(context, message: 'Đã sao chép mã!');
                    },
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(
                        Icons.copy_rounded,
                        size: 16,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (item.isPending) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () => _revoke(item.id),
                  icon: const Icon(
                    Icons.block_rounded,
                    size: 18,
                    color: Color(0xFFDC2626),
                  ),
                  label: const Text(
                    'Thu hồi',
                    style: TextStyle(color: Color(0xFFDC2626)),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: () => _resend(item.id),
                  icon: const Icon(
                    Icons.refresh_rounded,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  label: const Text('Cấp lại mã'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _resend(String invitationId) async {
    final notifier = ref.read(providerInvitationsNotifierProvider.notifier);
    final updated = await notifier.resendInvitation(invitationId);
    if (!mounted) return;
    if (updated != null && updated.token != null) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Text('Mã mới đã được cấp'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Gửi mã xác nhận mới này cho thợ:'),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SelectableText(
                  updated.token!,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: updated.token!));
                Navigator.pop(ctx);
                AppDialog.success(context, message: 'Đã sao chép mã mới!');
              },
              child: const Text('Sao chép mã'),
            ),
          ],
        ),
      );
    }
  }

  Future<void> _revoke(String invitationId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thu hồi lời mời?'),
        content: const Text(
          'Thợ sẽ không thể sử dụng mã này để gia nhập cơ sở nữa.',
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
            child: const Text('Thu hồi'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ref
          .read(providerInvitationsNotifierProvider.notifier)
          .revokeInvitation(invitationId);
    }
  }
}
