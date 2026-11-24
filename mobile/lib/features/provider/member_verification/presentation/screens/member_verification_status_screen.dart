import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../di/member_verification_providers.dart';
import '../../domain/entities/member_verification_entity.dart';

class MemberVerificationStatusScreen extends ConsumerWidget {
  final String memberId;

  const MemberVerificationStatusScreen({
    super.key,
    required this.memberId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(memberVerificationNotifierProvider(memberId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Xác minh chuyên môn (KYC)',
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
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            icon: const Icon(Icons.refresh, color: AppColors.primary),
            onPressed: () => ref
                .read(memberVerificationNotifierProvider(memberId).notifier)
                .loadProfile(),
          ),
        ],
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                Text(
                  'Lỗi khi tải thông tin: $err',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref
                      .read(
                        memberVerificationNotifierProvider(memberId).notifier,
                      )
                      .loadProfile(),
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        ),
        data: (profile) {
          if (profile == null) {
            return _buildEmptyState(context);
          }
          return _buildProfileState(context, profile);
        },
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
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
                Icons.assignment_ind_outlined,
                size: 52,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Chưa nộp hồ sơ chuyên môn',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0B1C30),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Để bắt đầu nhận đơn và thực hiện dịch vụ cho cơ sở, bạn cần nộp thông tin định danh và chứng chỉ chuyên môn.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFF6B7280), height: 1.4),
            ),
            const SizedBox(height: 28),
            ElevatedButton.icon(
              onPressed: () {
                context.push('/provider/memberships/$memberId/verification/form');
              },
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Bắt đầu khai hồ sơ'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileState(
    BuildContext context,
    MemberVerificationProfileEntity profile,
  ) {
    Color statusColor;
    String statusTitle;
    String statusMsg;
    IconData statusIcon;

    switch (profile.status) {
      case 'PENDING_REVIEW':
        statusColor = const Color(0xFFD97706);
        statusTitle = 'Hồ sơ đang kiểm duyệt';
        statusMsg = 'Hệ thống đang đối soát giấy tờ và chuyên môn của bạn.';
        statusIcon = Icons.hourglass_top_rounded;
      case 'APPROVED':
        statusColor = const Color(0xFF0F766E);
        statusTitle = 'Đã duyệt chuyên môn';
        statusMsg =
            'Chúc mừng! Bạn đã đủ điều kiện cung cấp dịch vụ trong cơ sở.';
        statusIcon = Icons.verified_rounded;
      case 'NEEDS_CHANGES':
        statusColor = const Color(0xFFEA580C);
        statusTitle = 'Yêu cầu bổ sung hồ sơ';
        statusMsg = 'Một số giấy tờ cần được cập nhật lại trước khi duyệt.';
        statusIcon = Icons.edit_note_rounded;
      case 'REJECTED':
        statusColor = const Color(0xFFDC2626);
        statusTitle = 'Hồ sơ chưa được duyệt';
        statusMsg = 'Vui lòng xem lý do bên dưới hoặc liên hệ chủ cơ sở.';
        statusIcon = Icons.cancel_outlined;
      default:
        statusColor = const Color(0xFF0F766E);
        statusTitle = 'Hồ sơ bản nháp';
        statusMsg = 'Vui lòng hoàn thành các bước để gửi xét duyệt.';
        statusIcon = Icons.description_outlined;
    }

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Icon(statusIcon, size: 68, color: statusColor),
        const SizedBox(height: 16),
        Text(
          statusTitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          statusMsg,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: Color(0xFF4B5563), height: 1.4),
        ),
        const SizedBox(height: 28),

        // Detail Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            children: [
              _row('Họ và tên', profile.legalFullName ?? 'Chưa cập nhật'),
              const Divider(height: 24),
              _row('Số CCCD', profile.nationalIdMasked ?? 'Chưa cập nhật'),
              const Divider(height: 24),
              _row(
                'Số dịch vụ đăng ký',
                '${profile.requestedProviderServiceIds.length} dịch vụ',
              ),
              const Divider(height: 24),
              _row(
                'Lần nộp hồ sơ',
                'Bản sửa đổi thứ ${profile.revisionNumber}',
              ),
              if (profile.submittedAt != null) ...[
                const Divider(height: 24),
                _row(
                  'Ngày gửi',
                  DateFormat('dd/MM/yyyy HH:mm').format(profile.submittedAt!),
                ),
              ],
            ],
          ),
        ),

        // Reviewer Note if any
        if (profile.decisionReason != null &&
            profile.decisionReason!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Ý kiến kiểm duyệt viên',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF9A3412),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  profile.decisionReason!,
                  style: const TextStyle(color: Color(0xFF7C2D12), height: 1.4),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 28),
        if (profile.isEditable)
          ElevatedButton.icon(
            onPressed: () {
              context.push(
                '/provider/memberships/$memberId/verification/form',
                extra: profile,
              );
            },
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Tiếp tục chỉnh sửa / Bổ sung'),
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
            onPressed: () => context.go('/home'),
            icon: const Icon(Icons.home_outlined),
            label: const Text('Về trang chủ'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 14)),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF0B1C30),
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}
