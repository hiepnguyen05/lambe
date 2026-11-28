import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../di/provider_members_providers.dart';
import '../../domain/entities/provider_member_entity.dart';
import '../widgets/member_status_badge.dart';
import '../widgets/suspend_member_dialog.dart';

class ProviderMemberDetailScreen extends ConsumerStatefulWidget {
  final String memberId;
  final ProviderMemberEntity? initialMember;

  const ProviderMemberDetailScreen({
    super.key,
    required this.memberId,
    this.initialMember,
  });

  @override
  ConsumerState<ProviderMemberDetailScreen> createState() =>
      _ProviderMemberDetailScreenState();
}

class _ProviderMemberDetailScreenState
    extends ConsumerState<ProviderMemberDetailScreen> {
  @override
  void initState() {
    super.initState();
    final alreadyLoaded = ref.exists(providerMembersNotifierProvider);
    Future.microtask(() {
      if (mounted && alreadyLoaded) {
        ref.read(providerMembersNotifierProvider.notifier).loadMembers();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final membersState = ref.watch(providerMembersNotifierProvider);
    final matches = membersState.valueOrNull?.where(
      (m) => m.id == widget.memberId,
    );
    final member = matches?.isNotEmpty == true ? matches!.first : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Hồ sơ nhân viên',
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
      body: member == null
          ? Center(
              child: membersState.isLoading
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          membersState.hasError
                              ? 'Chưa tải được hồ sơ nhân viên.'
                              : 'Không tìm thấy nhân viên trong danh sách hiện tại.',
                        ),
                        TextButton(
                          onPressed: () => ref
                              .read(providerMembersNotifierProvider.notifier)
                              .loadMembers(),
                          child: const Text('Tải lại danh sách'),
                        ),
                      ],
                    ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Header Card
                Container(
                  padding: const EdgeInsets.all(20),
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
                          shape: BoxShape.circle,
                          color: AppColors.surfaceContainerHigh,
                          image:
                              member.avatarUrl != null &&
                                  member.avatarUrl!.isNotEmpty
                              ? DecorationImage(
                                  image: NetworkImage(member.avatarUrl!),
                                  fit: BoxFit.cover,
                                )
                              : null,
                        ),
                        child:
                            member.avatarUrl == null ||
                                member.avatarUrl!.isEmpty
                            ? const Icon(
                                Icons.person_rounded,
                                size: 36,
                                color: AppColors.primary,
                              )
                            : null,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        member.displayName,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        member.isOwner
                            ? 'Chủ cơ sở / Quản trị'
                            : 'Kỹ thuật viên / Thợ',
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      const SizedBox(height: 14),
                      MemberStatusBadge(
                        status: member.status,
                        verificationStatus: member.verificationStatus,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Detail Section
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Thông tin hoạt động',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildRow(
                        'Ngày gia nhập',
                        DateFormat('dd/MM/yyyy, HH:mm').format(member.joinedAt),
                      ),
                      const Divider(height: 24),
                      _buildRow(
                        'Quyền nhận đơn dịch vụ',
                        member.canProvideServices
                            ? 'Đã kích hoạt'
                            : 'Chưa kích hoạt (Cần duyệt KYC)',
                        valueColor: member.canProvideServices
                            ? const Color(0xFF0F766E)
                            : const Color(0xFFD97706),
                      ),
                      const Divider(height: 24),
                      _buildRow(
                        'Phiên gia nhập',
                        'Phiên số ${member.membershipVersion}',
                      ),
                      if (member.suspensionReason != null &&
                          member.suspensionReason!.isNotEmpty) ...[
                        const Divider(height: 24),
                        _buildRow(
                          'Lý do đình chỉ',
                          member.suspensionReason!,
                          valueColor: const Color(0xFFDC2626),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Management actions (Service assignment & Schedule)
                if (member.isWorker && !member.isLeft) ...[
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.primaryContainer.withValues(
                                alpha: 0.2,
                              ),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.spa_rounded,
                              color: AppColors.primary,
                              size: 20,
                            ),
                          ),
                          title: const Text(
                            'Phân công dịch vụ chuyên môn',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: const Text(
                            'Cấp quyền thực hiện các dịch vụ đủ điều kiện',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Color(0xFF9CA3AF),
                          ),
                          onTap: () {
                            context.push(
                              '/provider/members/${member.id}/services',
                              extra: member.displayName,
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 56),
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.calendar_month_rounded,
                              color: Color(0xFF2563EB),
                              size: 20,
                            ),
                          ),
                          title: const Text(
                            'Ca làm việc & Lịch nghỉ phép',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: const Text(
                            'Quản lý ca cố định trong tuần và ngày nghỉ',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Color(0xFF9CA3AF),
                          ),
                          onTap: () {
                            context.push(
                              '/provider/members/${member.id}/schedule',
                              extra: member.displayName,
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // Operational Actions (Only for Worker, not Owner)
                if (member.isWorker &&
                    !member.isLeft &&
                    (!member.isSuspended ||
                        member.suspensionSource == 'OWNER')) ...[
                  if (member.isSuspended)
                    ElevatedButton.icon(
                      onPressed: () => _handleReactivate(member),
                      icon: const Icon(Icons.check_circle_outline_rounded),
                      label: const Text('Khôi phục quyền làm việc'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    )
                  else
                    OutlinedButton.icon(
                      onPressed: () => _handleSuspend(member),
                      icon: const Icon(Icons.lock_person_outlined),
                      label: const Text('Tạm đình chỉ nhân viên này'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFDC2626)),
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                ],
              ],
            ),
    );
  }

  Widget _buildRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF6B7280), fontSize: 14),
        ),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: valueColor ?? const Color(0xFF0B1C30),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _handleSuspend(ProviderMemberEntity member) async {
    final reason = await SuspendMemberDialog.show(
      context,
      memberName: member.displayName,
      isSuspending: true,
    );

    if (reason != null && mounted) {
      final success = await ref
          .read(providerMembersNotifierProvider.notifier)
          .suspendMember(member.id, reason);
      if (mounted) {
        if (success) {
          await AppDialog.success(
            context,
            message: 'Đã tạm đình chỉ nhân viên ${member.displayName}.',
          );
        } else {
          await AppDialog.error(
            context,
            message: 'Không thể đình chỉ nhân viên.',
          );
        }
      }
    }
  }

  Future<void> _handleReactivate(ProviderMemberEntity member) async {
    final reason = await SuspendMemberDialog.show(
      context,
      memberName: member.displayName,
      isSuspending: false,
    );

    if (reason != null && mounted) {
      final success = await ref
          .read(providerMembersNotifierProvider.notifier)
          .reactivateMember(member.id, reason);
      if (mounted) {
        if (success) {
          await AppDialog.success(
            context,
            message: 'Đã khôi phục quyền làm việc cho ${member.displayName}.',
          );
        } else {
          await AppDialog.error(
            context,
            message: 'Không thể khôi phục nhân viên (hãy kiểm tra điều kiện KYC/hồ sơ).',
          );
        }
      }
    }
  }
}
