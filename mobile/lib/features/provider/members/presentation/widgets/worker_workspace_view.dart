import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../providers/worker_workspace_notifier.dart';
import 'worker_online_toggle_card.dart';
import 'worker_receiving_radius_dialog.dart';

class WorkerWorkspaceView extends ConsumerWidget {
  const WorkerWorkspaceView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspace = ref.watch(workerWorkspaceProvider);
    final membership = workspace.activeMembership;
    final orgName = membership?.provider?.displayName ?? 'Cơ sở / Salon';
    final radius = workspace.settings?.effectiveRadiusKm ?? 10;
    final maxOrgRadius = workspace.settings?.organizationRadiusKm ?? 15;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        // Organization Affiliation Card
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.business_rounded,
                  color: AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      orgName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Kỹ thuật viên • ${membership?.displayName ?? ""}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFD1FAE5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Đang hoạt động',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF065F46),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Worker Online Card with GPS
        const WorkerOnlineToggleCard(),
        const SizedBox(height: 16),

        // Shortcuts Grid
        Row(
          children: [
            Expanded(
              child: _buildShortcutCard(
                icon: Icons.calendar_month_rounded,
                iconColor: const Color(0xFF2563EB),
                bgColor: const Color(0xFFEFF6FF),
                title: 'Lịch ca & Nghỉ phép',
                subtitle: 'Xem ca, xin nghỉ',
                onTap: () => context.push('/provider/worker/schedule'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildShortcutCard(
                icon: Icons.payments_rounded,
                iconColor: const Color(0xFF059669),
                bgColor: const Color(0xFFD1FAE5),
                title: 'Tiền mặt thu hộ',
                subtitle: 'Đối soát cơ sở',
                onTap: () => context.push('/provider/worker/collections'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildShortcutCard(
                icon: Icons.radar_rounded,
                iconColor: const Color(0xFFD97706),
                bgColor: const Color(0xFFFEF3C7),
                title: 'Bán kính nhận việc',
                subtitle: '$radius km (Tối đa $maxOrgRadius)',
                onTap: () {
                  WorkerReceivingRadiusDialog.show(
                    context,
                    currentRadius: radius,
                    maxOrganizationRadius: maxOrgRadius,
                  );
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildShortcutCard(
                icon: Icons.verified_user_rounded,
                iconColor: const Color(0xFF7C3AED),
                bgColor: const Color(0xFFF3E8FF),
                title: 'Hồ sơ nghề & KYC',
                subtitle: 'Chứng chỉ, kỹ năng',
                onTap: () {
                  if (membership != null) {
                    context.push(
                      '/provider/memberships/${membership.id}/verification/status',
                    );
                  }
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Assigned orders title
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Đơn hàng được phân công',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0B1C30),
              ),
            ),
            TextButton(
              onPressed: () => context.push('/provider/orders'),
              child: const Text('Xem tất cả'),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Information banner
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: const [
              Icon(Icons.assignment_turned_in_outlined,
                  color: AppColors.primary, size: 24),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Khi khách hàng đặt lịch hoặc cơ sở gán việc, đơn hàng sẽ hiển thị tại đây kèm thông báo đẩy.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF4B5563),
                    height: 1.3,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildShortcutCard({
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0B1C30),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

