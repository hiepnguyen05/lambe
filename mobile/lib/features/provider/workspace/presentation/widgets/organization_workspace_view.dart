import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../members/di/provider_members_providers.dart';
import '../../../members/domain/entities/provider_member_entity.dart';
import '../../../members/presentation/widgets/organization_emergency_receiving_tile.dart';
import '../../di/provider_workspace_providers.dart';

class OrganizationWorkspaceView extends ConsumerWidget {
  const OrganizationWorkspaceView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membersAsync = ref.watch(providerMembersNotifierProvider);
    final members = membersAsync.valueOrNull ?? const <ProviderMemberEntity>[];

    final activeWorkers = members.where((m) => m.role == 'WORKER' && m.status == 'ACTIVE').toList();
    final pendingWorkers = members.where((m) => m.status == 'PENDING_VERIFICATION').toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Công tắc tổng khẩn cấp nhận đơn toàn salon
        const OrganizationEmergencyReceivingTile(),
        const SizedBox(height: 16),

        // 2. Thống kê giám sát thợ trực tuyến
        _buildStaffMonitorCard(context, activeWorkers.length, pendingWorkers.length, members.length),
        const SizedBox(height: 16),

        // 3. Khối điều phối đơn hàng cơ sở
        _buildDispatchOperationsCard(context, ref),
        const SizedBox(height: 16),

        // 4. Lưới thao tác quản trị cơ sở
        _buildQuickActionsGrid(context),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildStaffMonitorCard(
    BuildContext context,
    int activeCount,
    int pendingCount,
    int totalCount,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.people_alt_rounded, color: Color(0xFF0F766E), size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Nhân sự cơ sở',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () => context.push('/provider/members'),
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    children: [
                      Text(
                        'Xem tất cả',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF0F766E)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  label: 'Đang hoạt động',
                  count: '$activeCount',
                  dotColor: const Color(0xFF10B981),
                  bgColor: const Color(0xFFECFDF5),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricTile(
                  label: 'Chờ duyệt',
                  count: '$pendingCount',
                  dotColor: const Color(0xFFF59E0B),
                  bgColor: const Color(0xFFFFFBEB),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricTile(
                  label: 'Tổng nhân sự',
                  count: '$totalCount',
                  dotColor: const Color(0xFF6B7280),
                  bgColor: const Color(0xFFF3F4F6),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String count,
    required Color dotColor,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF4B5563), fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            count,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDispatchOperationsCard(BuildContext context, WidgetRef ref) {
    final pendingOrders = ref.watch(providerIncomingOrdersProvider);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.local_shipping_outlined, color: Color(0xFF0F766E), size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Điều phối & Đơn tiệm',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () => context.push('/provider/orders'),
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    children: [
                      Text(
                        'Xem lịch hẹn',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF0F766E)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFFCCFBF1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.assignment_turned_in_rounded, color: Color(0xFF0F766E), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pendingOrders != null
                            ? 'Có 1 đơn hàng mới đang chờ xử lý'
                            : 'Hệ thống vận hành bình thường',
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        pendingOrders != null
                            ? 'Bấm để gán thợ hoặc xử lý đơn đặt ngay'
                            : 'Đơn của khách sẽ tự động đổ về salon theo dịch vụ',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context) {
    final actions = [
      _QuickAction(
        title: 'Quản lý thợ',
        subtitle: 'Danh sách & phân quyền',
        icon: Icons.badge_outlined,
        color: const Color(0xFF0F766E),
        bgColor: const Color(0xFFF0FDFA),
        route: '/provider/members',
      ),
      _QuickAction(
        title: 'Mời thợ mới',
        subtitle: 'Tạo mã mời tham gia',
        icon: Icons.person_add_alt_1_outlined,
        color: const Color(0xFF2563EB),
        bgColor: const Color(0xFFEFF6FF),
        route: '/provider/invitations',
      ),
      _QuickAction(
        title: 'Phân công dịch vụ',
        subtitle: 'Ma trận món & thợ',
        icon: Icons.design_services_outlined,
        color: const Color(0xFF7C3AED),
        bgColor: const Color(0xFFF5F3FF),
        route: '/provider/services',
      ),
      _QuickAction(
        title: 'Lịch ca tuần',
        subtitle: 'Xếp lịch & ngày nghỉ',
        icon: Icons.calendar_month_outlined,
        color: const Color(0xFFD97706),
        bgColor: const Color(0xFFFFFBEB),
        route: '/provider/schedule',
      ),
      _QuickAction(
        title: 'Duyệt bài Feed',
        subtitle: 'Kiểm duyệt bài thợ',
        icon: Icons.rate_review_outlined,
        color: const Color(0xFFEA580C),
        bgColor: const Color(0xFFFFF7ED),
        route: '/provider/feed-review',
      ),
      _QuickAction(
        title: 'Ví & Đối soát',
        subtitle: 'Thu tiền mặt thợ nộp',
        icon: Icons.account_balance_wallet_outlined,
        color: const Color(0xFF059669),
        bgColor: const Color(0xFFECFDF5),
        route: '/provider/income',
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Lối tắt quản trị Salon',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.5,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) {
            final action = actions[index];
            return InkWell(
              onTap: () => context.push(action.route),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(12),
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
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: action.bgColor,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(action.icon, color: action.color, size: 22),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            action.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0B1C30),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            action.subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _QuickAction {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final String route;

  const _QuickAction({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.bgColor,
    required this.route,
  });
}

